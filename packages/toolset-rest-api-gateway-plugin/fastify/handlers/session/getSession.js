// @flow

import type RestAPIServer, { Route } from "~/toolset-rest-api-gateway-plugin/fastify/RestAPIServer";
import {
  burlaesgDecode, burlaesgEncode, hs256JWTEncode,
} from "~/toolset-rest-api-gateway-plugin/fastify/security";

export default function createRouteHandler (server: RestAPIServer, route: Route) {
  return {
    category: "session", method: "GET", fastifyRoute: route,
    requiredRuntimeRules: [
      "userAgentState",
      "clientRedirectPath", "grantProviderState",
      "grantExpirationDelay", "tokenExpirationDelay",
    ],
    requiredRules: [
      "authorizationGrant", "error", "errorDescription", "errorURI",
    ],
    builtinRules: {},
    prepare (/* fastify */) {
      this._identity = server.getIdentity();
      if (!this._identity) {
        throw new Error("Cannot prepare session route GET: identity not configured");
      }
      this.builtinRules.userAgentState = ["cookies", this._identity.getClientCookieName()];
      this.scopeRules = server.prepareScopeRules(this);
      this._clientURI = this._identity.clientURI;
      this._secret = this._identity.clientSecret;
    },
    preload () {
      // const connection = await server.getDiscourse().acquireConnection(
      //    route.config.valos.subject, { newPartition: false }).asActiveConnection();
      // const vRoot = server.getEngine().getVrapper([connection.getPartitionRawId()]);
    },
    handleRequest (request, reply) {
      const scope = server.buildScope(request, this.scopeRules);
      server.infoEvent(1, () => [
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

        const secret = this._identity.clientSecret;
        ({ iv, alg, payload } = burlaesgDecode(scope.authorizationGrant, secret));
        ({
          nonce, identityPartition, timeStamp: grantTimeStamp,
          claims: { email, preferred_username },
        } = payload);
        console.log("authorizing session with payload:", payload);

        if (!(timeStamp < Number(grantTimeStamp) + (scope.grantExpirationDelay || 60))) {
          reply.code(401);
          reply.send("Authorization session request has expired");
          throw new Error("Expired");
          // return false;
        }

        sessionToken = { timeStamp, nonce, identityPartition };
        reply.setCookie(this._identity.getSessionCookieName(),
            burlaesgEncode(sessionToken, secret, iv), {
              httpOnly: true,
              secure: true, maxAge: scope.tokenExpirationDelay, path: scope.clientRedirectPath,
            });

        clientToken = {
          iss: this._clientURI,
          sub: identityPartition,
          iat: timeStamp,
          exp: timeStamp + scope.tokenExpirationDelay,
          email, preferred_username,
          // aud: "", nbf: "", jti: "",
        };
        reply.setCookie(this._identity.getClientCookieName(),
            hs256JWTEncode(clientToken, secret), {
              httpOnly: false,
              secure: true, maxAge: scope.tokenExpirationDelay, path: scope.clientRedirectPath,
            });

        reply.code(302);
        reply.redirect(scope.clientRedirectPath);
        return true;
      } catch (error) {
        throw server.wrapErrorEvent(error,
            new Error(`authorizeSessionWithGrant(${this._clientURI})`),
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
