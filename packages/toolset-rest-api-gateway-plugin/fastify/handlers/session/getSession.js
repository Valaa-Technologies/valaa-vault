// @flow

import type RestAPIServer, { Route } from "~/toolset-rest-api-gateway-plugin/fastify/RestAPIServer";
import { authorizeSessionWithGrant } from "~/toolset-rest-api-gateway-plugin/fastify/security";

export default function createRouteHandler (server: RestAPIServer, route: Route) {
  return {
    category: "session", method: "GET", fastifyRoute: route,
    requiredRuntimeRules: [
      "clientRedirectPath", "grantProviderState", "userAgentState",
      "grantExpirationDelay", "tokenExpirationDelay",
    ],
    requiredRules: [
      "authorizationGrant", "error", "errorDescription", "errorURI",
    ],
    builtinRules: {},
    prepare (/* fastify */) {
      this.scopeRules = server.prepareScopeRules(this);
    },
    preload () {
      // const connection = await server.getDiscourse().acquirePartitionConnection(
      //    route.config.valos.subject, { newPartition: false }).getActiveConnection();
      // const vRoot = server.getEngine().getVrapper([connection.getPartitionRawId()]);
    },
    handleRequest (request, reply) {
      const scope = server.buildScope(request, this.scopeRules);
      server.infoEvent(1, () => [
        "\n\trequest.query:", request.query,
        "\n\trequest.cookies:", request.cookies,
      ]);
      if (scope.error) {
        throw new Error(`Authorization error: ${scope.errorDescription}`);
      }
      if (!(scope.userAgentState && (scope.userAgentState === scope.grantProviderState))) {
        throw new Error("Inconsistent session authorization state");
      }
      if (!authorizeSessionWithGrant(server, request, reply,
          scope.authorizationGrant, scope.clientRedirectPath,
          scope.grantExpirationDelay, scope.tokenExpirationDelay)) {
        return false;
      }
      reply.code(302);
      reply.redirect(scope.clientRedirectPath);
      return true;
    },
  };
}
