// @flow

import crypto from "crypto";

import type { PrefixRouter, Route } from "~/web-spindle/MapperService";
import {
  extractAuthorizationGrantContent, assembleSimpleSessionEnvelope, fillReplySessionAndClientCookies,
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
      "assembleSessionEnvelope"
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
      const now = Math.floor(Date.now() / 1000);
      const { assembleSessionEnvelope } = this.runtime.ruleResolvers;
      return thenChainEagerly(scope.routeRoot, [
        () => {
          if (scope.error) {
            throw new Error(`Authorization error: ${scope.errorDescription}`);
          }
          if (!scope.userAgentState || (scope.userAgentState !== scope.grantProviderState)) {
            throw new Error("Inconsistent session authorization state");
          }
          const { alg, payload } = scope.grantContent = extractAuthorizationGrantContent(
              router, scope.identity, scope.authorizationGrant);
          if (!(now < Number(payload.timeStamp) + scope.grantExpirationDelay)) {
            reply.code(401);
            reply.send("Session authorization request has expired");
            throw new Error("Expired");
          }
          // TODO(iridian, 2020-04): Validate alg
          router.logEvent(1, () => [
            `Authorizing session with alg '${alg}' payload:`, payload,
          ]);
          return payload;
        },
        grantPayload => (assembleSessionEnvelope
            ? router.resolveToScope(
                "sessionEnvelope", assembleSessionEnvelope, scope.routeRoot, valkOptions)
            : (scope.sessionEnvelope = assembleSimpleSessionEnvelope(router, grantPayload))),
        sessionEnvelope => {
          fillReplySessionAndClientCookies(router, reply, sessionEnvelope, {
            identity: scope.identity, tokenExpirationDelay: scope.tokenExpirationDelay,
            clientRedirectPath: scope.clientRedirectPath,
            now, iv: scope.grantContent.iv, nonce: scope.grantContent.payload.nonce,
          });
          reply.code(302);
          reply.redirect(scope.clientRedirectPath);
          return true;
        },
      ], error => {
        throw router.wrapErrorEvent(error, 1,
          new Error(`authorizeSessionWithGrant(${scope.identity.clientURI})`),
          "\n\tnow:", now,
          "\n\tclientRedirectPath:", scope.clientRedirectPath,
          "\n\tgrantExpirationDelay:", scope.grantExpirationDelay,
          "\n\ttokenExpirationDelay:", scope.tokenExpirationDelay);
      });
    },
  };
}
