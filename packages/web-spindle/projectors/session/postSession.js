// @flow

import crypto from "crypto";

import type { PrefixRouter, Route } from "~/web-spindle/MapperService";
import {
  extractSessionPayload, extractClientToken, fillReplySessionAndClientCookies,
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
      router.setRefreshSessionProjector(this);
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

    handler (request, reply, isAutoRefreshSession) {
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
      const nowMS = Date.now();
      const refreshResolver = this.runtime.ruleResolvers.refreshSessionEnvelope
          || [_refreshExistingSessionEnvelope.bind(router, nowMS), true];
      let timeStamp, nonce, identityChronicle, clientRedirectPath;
      return thenChainEagerly(scope.routeRoot, [
        function _validateSessionPayload () {
          const { iat, sub }
              = scope.clientClaims
              = extractClientToken(router, scope.clientCookie).payload;
          ({ timeStamp, nonce, identityChronicle, clientRedirectPath }
              = scope.sessionPayload
              = extractSessionPayload(router, scope.sessionCookie));
          if ((iat !== timeStamp) || (sub !== identityChronicle)) {
            // Either implementation error or security vulnerability.
            router.errorEvent(0, "Inconsistent session and client cookies",
                iat, sub, timeStamp, identityChronicle);
            reply.code(400);
            throw new Error("Invalid cookies");
          }
          if (!(nowMS < (Number(timeStamp) + scope.refreshExpirationDelay) * 1000)) {
            reply.code(401);
            throw new Error("Session refresh window has expired");
          }
        },
        function _refreshSessionEnvelope () {
          return router.resolveToScope(
              "sessionEnvelope", refreshResolver, scope.routeRoot, valkOptions);
        },
        function _replyWithRefreshedSessionEnvelope (sessionEnvelope) {
          if (!sessionEnvelope) {
            if (!reply.statusCode) reply.code(403);
            reply.send("Session refresh rejected");
            throw new Error("Expired");
          } else {
            fillReplySessionAndClientCookies(router, reply, sessionEnvelope, {
              identity: scope.identity,
              tokenExpirationDelay: scope.tokenExpirationDelay,
              clientRedirectPath,
              now: Math.floor(nowMS / 1000),
              iv: null,
              nonce,
              refreshRequestCookiesOf: isAutoRefreshSession && request,
            });
            if (!isAutoRefreshSession) {
              reply.code(302);
              reply.redirect(clientRedirectPath);
            }
          }
          return true;
        },
      ], error => {
        throw router.wrapErrorEvent(error, 1,
          new Error(`refreshSession(${scope.identity.clientURI})`),
          "\n\tnow:", nowMS,
          "\n\ttimeStamp:", timeStamp,
          "\n\tidentityChronicle:", identityChronicle,
          "\n\tclientRedirectPath:", clientRedirectPath,
        );
      });
    },
  };
}

function _refreshExistingSessionEnvelope (now, engine, head, valkOptions) {
  const { iss, sub, iat, exp, ...clientClaimsFields }
      = valkOptions.scope.clientClaims;
  const { timeStamp, nonce, identityChronicle, clientRedirectPath, ...sessionPayloadFields }
      = valkOptions.scope.sessionPayload;
  this.logEvent(1, () => [
    `Refreshing existing session:`,
    `\n\t\tsessionPayloadFields:`, sessionPayloadFields,
    `\n\t\tclientClaimsFields:`, clientClaimsFields,
  ]);
  return { identityChronicle, sessionPayloadFields, clientClaimsFields };
}
