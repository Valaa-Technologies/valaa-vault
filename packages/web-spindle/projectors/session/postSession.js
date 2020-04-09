// @flow

import crypto from "crypto";

import type { PrefixRouter, Route } from "~/web-spindle/MapperService";
import {
  extractSessionPayload, extractClientToken, assembleSimpleSessionEnvelope,
  fillReplySessionAndClientCookies,
} from "~/web-spindle/tools/security";

import { dumpObject } from "~/tools/wrapError";
import { thenChainEagerly } from "~/tools/thenChainEagerly";

export default function createProjector (router: PrefixRouter, route: Route) {
  return {
    requiredRules: [
      "routeRoot",
      "refreshExpirationDelay", "tokenExpirationDelay",
    ],
    runtimeRules: [
      "refreshSessionEnvelope",
    ],
    valueAssertedRules: [
      "clientCookie", "sessionCookie",
    ],

    prepare () {
      this.runtime = router.createProjectorRuntime(this, route);
      if (!this.runtime.identity) {
        throw new Error("Cannot prepare session route POST: service identity not configured");
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
      if (!scope.clientCookie || !scope.sessionCookie) {
        reply.code(404);
        reply.send("No session found");
        return true;
      }
      const now = Math.floor(Date.now() / 1000);
      const { refreshSessionEnvelope } = this.runtime.ruleResolvers;
      let timeStamp, nonce, identityChronicle, clientRedirectPath;
      return thenChainEagerly(scope.routeRoot, [
        () => {
          const {
            payload: { iss, sub, iat, exp, ...clientClaimsFields },
          } = extractClientToken(router, scope.clientCookie);
          scope.clientClaims = clientClaimsFields;
          ({
            timeStamp, nonce, identityChronicle, clientRedirectPath,
          } = scope.sessionPayload = extractSessionPayload(router, scope.sessionCookie));
          if ((iat !== timeStamp) || (identityChronicle !== sub)) {
            // Either implementation error or security vulnerability.
            router.errorEvent(0, "Inconsistent session and client cookies",
                iat, sub, timeStamp, identityChronicle);
            console.log(0, "Inconsistent session and client cookies",
                iat, sub, timeStamp, identityChronicle);
            throw new Error("Invalid cookies");
          }
          if (!(now < Number(timeStamp) + scope.refreshExpirationDelay)) {
            reply.code(401);
            reply.send("Session refresh window has expired");
            throw new Error("Expired");
          }
          const payload = { identityChronicle, claims: clientClaimsFields };
          router.logEvent(1, () => [
            `Refreshing session authorization with payload:`, payload,
          ]);
          return payload;
        },
        grantPayload => (refreshSessionEnvelope
          ? router.resolveToScope(
              "sessionEnvelope", refreshSessionEnvelope, scope.routeRoot, valkOptions)
          : (scope.sessionEnvelope = assembleSimpleSessionEnvelope(router, grantPayload))),
        sessionEnvelope => {
          if (!sessionEnvelope) {
            if (!reply.statusCode) reply.code(403);
            reply.send("Session refresh rejected");
          } else {
            fillReplySessionAndClientCookies(router, reply, sessionEnvelope, {
              identity: scope.identity, tokenExpirationDelay: scope.tokenExpirationDelay,
              clientRedirectPath,
              now, iv: null, nonce,
            });
            reply.code(302);
            reply.redirect(clientRedirectPath);
          }
          return true;
        },
      ], error => {
        throw router.wrapErrorEvent(error, 1,
          new Error(`refreshSession(${scope.identity.clientURI})`),
          "\n\tnow:", now,
          "\n\ttimeStamp:", timeStamp,
          "\n\tidentityChronicle:", identityChronicle,
          "\n\tclientRedirectPath:", clientRedirectPath,
        );
      });
    },
  };
}
