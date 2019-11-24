// @flow

import type { PrefixRouter /* , Route */ } from "~/rest-api-spindle/MapperService";
import {
  burlaesgDecode, burlaesgEncode, hs256JWTEncode,
} from "~/rest-api-spindle/tools/security";

export default function createProjector (router: PrefixRouter /* , route: Route */) {
  return {
    requiredRules: [
      "routeRoot",
      "clientRedirectPath", "grantExpirationDelay", "tokenExpirationDelay",
      "userAgentState",
      "authorizationGrant", "grantProviderState", "error", "errorDescription", "errorURI",
    ],

    prepare () {
      this.runtime = router.createProjectorRuntime(this);

      if (!this.runtime.identity) {
        throw new Error("Cannot prepare session route GET: service identity not configured");
      }
      this.runtime.scopeBase.identity = Object.freeze({
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
      const { scope } = router.buildRuntimeVALKOptions(this, this.runtime, request, reply);
      router.infoEvent(1, () => [
        "\n\trequest.query:", request.query,
        "\n\trequest.cookies:", request.cookies,
      ]);
      /* eslint-disable camelcase */
      let iv, alg, grantTimeStamp, nonce, identityPartition, payload, email, preferred_username;
      let sessionToken, clientToken;
      const timeStamp = Math.floor(Date.now() / 1000);
      try {
        if (scope.error) {
          throw new Error(`Authorization error: ${scope.errorDescription}`);
        }
        if (!scope.userAgentState || (scope.userAgentState !== scope.grantProviderState)) {
          throw new Error("Inconsistent session authorization state");
        }

        ({ iv, alg, payload } =
            burlaesgDecode(scope.authorizationGrant, scope.identity.clientSecret));
        ({
          nonce, identityPartition, timeStamp: grantTimeStamp,
          claims: { email, preferred_username },
        } = payload);
        console.log("Authorizing session with payload:", payload);

        if (!(timeStamp < Number(grantTimeStamp) + scope.grantExpirationDelay)) {
          reply.code(401);
          reply.send("Authorization session request has expired");
          throw new Error("Expired");
          // return false;
        }

        sessionToken = { timeStamp, nonce, identityPartition };
        reply.setCookie(scope.identity.sessionCookieName,
            burlaesgEncode(sessionToken, scope.identity.clientSecret, iv), {
              httpOnly: true,
              secure: true, maxAge: scope.tokenExpirationDelay, path: scope.clientRedirectPath,
            });

        clientToken = {
          iss: scope.identity.clientURI,
          sub: identityPartition,
          iat: timeStamp,
          exp: timeStamp + scope.tokenExpirationDelay,
          email, preferred_username,
          // aud: "", nbf: "", jti: "",
        };
        reply.setCookie(scope.identity.clientCookieName,
            hs256JWTEncode(clientToken, scope.identity.clientSecret), {
              httpOnly: false,
              secure: true, maxAge: scope.tokenExpirationDelay, path: scope.clientRedirectPath,
            });

        reply.code(302);
        reply.redirect(scope.clientRedirectPath);
        return true;
      } catch (error) {
        throw router.wrapErrorEvent(error,
            new Error(`authorizeSessionWithGrant(${scope.identity.clientURI})`),
            "\n\ttimeStamp:", timeStamp,
            "\n\tauthorizationGrant:", scope.authorizationGrant,
            "\n\tclientRedirectPath:", scope.clientRedirectPath,
            "\n\tgrantExpirationDelay:", scope.grantExpirationDelay,
            "\n\ttokenExpirationDelay:", scope.tokenExpirationDelay,
            "\n\tiv:", iv,
            "\n\talg:", alg,
            "\n\tgrantTimeStamp:", grantTimeStamp,
            "\n\tnonce:", nonce,
            "\n\tidentityPartition:", identityPartition,
            "\n\temail:", email,
            "\n\tsessionToken:", sessionToken,
            "\n\tclientToken:", clientToken);
      }
    },
  };
}

/* eslint-enable camelcase */
