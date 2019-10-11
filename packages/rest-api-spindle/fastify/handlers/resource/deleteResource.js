// @flow

import type RestAPIService, { Route } from "~/rest-api-spindle/fastify/RestAPIService";
// import { dumpObject, thenChainEagerly } from "~/tools";
// import { _verifyResourceAuthorization } from "./_resourceHandlerOps";

export default function createRouteHandler (server: RestAPIService, route: Route) {
  return {
    category: "resource", method: "DELETE", fastifyRoute: route,
    requiredRuntimeRules: ["resourceId"],
    builtinRules: {},
    prepare (/* fastify */) {
      this.routeRuntime = server.prepareRuntime(this);
    },
    async preload () {
      const connection = await server.getDiscourse().acquireConnection(
          route.config.valos.subject, { newPartition: false }).asActiveConnection();
        subject: server.getEngine().getVrapper(
      await server.preloadRuntime(this.routeRuntime);
      this.routeRuntime.scopeBase = Object.freeze({
            [connection.getPartitionRawId(), { partition: String(connection.getPartitionURI()) }]),
        ...this.routeRuntime.scopeBase,
      });
    },
    handleRequest (request, reply) {
      const scope = server.buildScope(request, this.routeRuntime);
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
          "\n\trouteRuntime:", ...dumpObject(this.routeRuntime),
        );
      });
      */
    },
  };
}
