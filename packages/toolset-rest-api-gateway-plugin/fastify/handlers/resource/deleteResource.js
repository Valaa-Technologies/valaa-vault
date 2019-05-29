// @flow

import type RestAPIServer, { Route } from "~/toolset-rest-api-gateway-plugin/fastify/RestAPIServer";
// import { dumpObject, thenChainEagerly } from "~/tools";
// import { _verifyResourceAuthorization } from "./_resourceHandlerOps";

export default function createRouteHandler (server: RestAPIServer, route: Route) {
  return {
    category: "resource", method: "DELETE", fastifyRoute: route,
    requiredRuntimeRules: ["resourceId"],
    builtinRules: {},
    prepare (/* fastify */) {
      this.scopeRules = server.prepareScopeRules(this);
    },
    async preload () {
      const connection = await server.getDiscourse().acquireConnection(
          route.config.valos.subject, { newPartition: false }).asActiveConnection();
      await server.preloadScopeRules(this.scopeRules);
      this.scopeRules.scopeBase = Object.freeze({
        subject: server.getEngine().getVrapper(
            [connection.getPartitionRawId(), { partition: String(connection.getPartitionURI()) }]),
        ...this.scopeRules.scopeBase,
      });
    },
    handleRequest (request, reply) {
      const scope = server.buildScope(request, this.scopeRules);
      server.infoEvent(1, () => [
        `${this.name}:`, scope.resourceId,
        "\n\trequest.query:", request.query,
      ]);
      reply.code(501);
      reply.send("Unimplemented");
      return true;
      // Root resource deletion not implemented yet, due to lack of
      // mechanisms for declaring what sub-resources should be
      // destroyed as well.
      /*
      if (_verifyResourceAuthorization(server, route, request, reply, scope)) return true;
      scope.resource = server._engine.tryVrapper([scope.resourceId]);
      if (!scope.resource) {
        reply.code(404);
        reply.send(`No such ${route.config.resourceTypeName} route resource: ${scope.resourceId}`);
        return false;
      }
      const wrap = new Error(this.name);
      return thenChainEagerly(null, [
        () => scope.resource.destroy(),
        eventResult => eventResult.getPersistedEvent(),
        () => {
          const results = "DESTROYED";
          reply.code(200);
          reply.send(results);
          server.infoEvent(2, () => [
            `${this.name}:`,
            "\n\tresults:", ...dumpObject(results),
          ]);
          return true;
        },
      ], (error) => {
        throw server.wrapErrorEvent(error, wrap,
          "\n\trequest.query:", ...dumpObject(request.query),
          "\n\tscope.resource:", ...dumpObject(scope.resource),
          "\n\tscopeRules:", ...dumpObject(this.scopeRules),
        );
      });
      */
    },
  };
}
