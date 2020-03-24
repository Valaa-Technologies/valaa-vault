// @flow

import crypto from "crypto";

import type { PrefixRouter, Route } from "~/web-spindle/MapperService";
import {
  burlaesgDecode, burlaesgEncode, generateBurlaesgIV, hs256JWTEncode,
} from "~/web-spindle/tools/security";

import { dumpObject } from "~/tools/wrapError";
import { thenChainEagerly } from "~/tools/thenChainEagerly";

export default function createProjector (router: PrefixRouter, route: Route) {
  return {
    requiredRules: [
      "routeRoot",
      "grantExpirationDelay", "tokenExpirationDelay",
      "error", "errorDescription", "errorURI",
    ],
    runtimeRules: [
      "assembleSessionPayload"
    ],
    valueAssertedRules: [
      "clientRedirectPath", "userAgentState", "authorizationGrant", "grantProviderState",
    ],

    prepare () {
      this.runtime = router.createProjectorRuntime(this, route);
      router.setSessionAuthorizationEnabled();

      if (!this.runtime.identity) {
        throw new Error("Cannot prepare session route GET: service identity not configured");
      }
      this.runtime.scopePreparations.identity = Object.freeze({
        crypto,
        clientSecret: this.runtime.identity.clientSecret,
        clientURI: this.runtime.identity.clientURI,
        clientCookieName: this.runtime.identity.getClientCookieName(),
        sessionCookieName: this.runtime.identity.getSessionCookieName(),
      });
    },

    preload () {
      return router.preloadRuntimeResources(this, this.runtime);
    },

    handler (request, reply) {
      router.infoEvent(1, () => [`${this.name}:`,
        "\n\trequest.params:", ...dumpObject(request.params),
        "\n\trequest.query:", ...dumpObject(request.query),
        "\n\trequest.cookies:", ...dumpObject(Object.keys(request.cookies || {})),
      ]);
      const valkOptions = router.buildRuntimeVALKOptions(this, this.runtime, request, reply);
      const scope = valkOptions.scope;
      if (router.presolveRulesToScope(this.runtime, valkOptions)) {
        router.warnEvent(1, () => [`RUNTIME RULE FAILURE ${router._routeName(route)}.`]);
        return true;
      }
      /*
      router.infoEvent(2, () => [`${this.name}:`,
        "\n\tresource:", ...dumpObject(scope.resource),
        `\n\t${scope.mappingName}:`, ...dumpObject(scope.mapping),
        `\n\ttarget:`, ...dumpObject(scope.target),
      ]);
      */
      /* eslint-disable camelcase */
      let sessionPayload, clientToken;
      const timeStamp = Math.floor(Date.now() / 1000);
      const { assembleSessionPayload } = this.runtime.ruleResolvers;
      return thenChainEagerly(scope.routeRoot, [
        () => {
          if (scope.error) {
            throw new Error(`Authorization error: ${scope.errorDescription}`);
          }
          if (!scope.userAgentState || (scope.userAgentState !== scope.grantProviderState)) {
            throw new Error("Inconsistent session authorization state");
          }
        },
        () => (assembleSessionPayload
            ? router.resolveToScope(
                "sessionPayload", assembleSessionPayload, scope.routeRoot, valkOptions)
            : _assembleSimpleAuthSessionPayload(router, scope)),
        sessionPayloadEnvelope => {
          const {
            iv, nonce, grantTimeStamp, identityChronicle, email, preferred_username,
            clientTokenFields,
            ...sessionPayloadFields
          } = sessionPayloadEnvelope;
          const clientRedirectPath = scope.clientRedirectPath;
          ["grantTimeStamp", "identityChronicle", "email", "preferred_username"].forEach(name => {
            if (sessionPayloadEnvelope[name] === undefined) {
              throw new Error(`session payload '${name}' resolution undefined`);
            }
          });
          if (!(timeStamp < Number(grantTimeStamp) + scope.grantExpirationDelay)) {
            reply.code(401);
            reply.send("Authorization session request has expired");
            throw new Error("Expired");
          }
          sessionPayload = {
            timeStamp, nonce: nonce || "", identityChronicle, clientRedirectPath,
            ...sessionPayloadFields,
          };
          reply.setCookie(
              scope.identity.sessionCookieName,
              burlaesgEncode(sessionPayload,
                  scope.identity.clientSecret.slice(0, 30),
                  iv || generateBurlaesgIV()),
              {
                httpOnly: true, secure: true, maxAge: scope.tokenExpirationDelay,
                path: clientRedirectPath,
              });
          clientToken = {
            iss: scope.identity.clientURI,
            sub: identityChronicle,
            iat: timeStamp,
            exp: timeStamp + scope.tokenExpirationDelay,
            email,
            preferred_username,
            ...(clientTokenFields || {}),
            // aud: "", nbf: "", jti: "",
          };
          reply.setCookie(
              scope.identity.clientCookieName,
              hs256JWTEncode(clientToken, scope.identity.clientSecret),
              {
                httpOnly: false, secure: true, maxAge: scope.tokenExpirationDelay,
                path: clientRedirectPath,
              });
          reply.code(302);
          reply.redirect(clientRedirectPath);
          return true;
        },
      ], error => {
        throw router.wrapErrorEvent(error, 1,
          new Error(`authorizeSessionWithGrant(${scope.identity.clientURI})`),
          "\n\ttimeStamp:", timeStamp,
          "\n\tauthorizationGrant:", scope.authorizationGrant,
          "\n\tclientRedirectPath:", scope.clientRedirectPath,
          "\n\tgrantExpirationDelay:", scope.grantExpirationDelay,
          "\n\ttokenExpirationDelay:", scope.tokenExpirationDelay,
          "\n\tsessionPayload:", sessionPayload,
          "\n\tclientToken:", clientToken);
      });
    },
  };
}

function _assembleSimpleAuthSessionPayload (router, scope) {
  const { iv, alg, payload } =
      burlaesgDecode(scope.authorizationGrant, scope.identity.clientSecret.slice(0, 30));
  const {
    nonce, timeStamp: grantTimeStamp,
    claims: { email, preferred_username },
    identityChronicle, identityPartition,
  } = payload;
  router.logEvent(1, () => [`Authorizing session with alg '${alg}' payload:`, payload]);
  return {
    iv, nonce, grantTimeStamp,
    email, preferred_username, identityChronicle: identityChronicle || identityPartition,
  };
}

/* eslint-enable camelcase */
