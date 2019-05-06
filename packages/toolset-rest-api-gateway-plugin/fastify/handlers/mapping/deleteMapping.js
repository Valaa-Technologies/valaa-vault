// @flow

import type RestAPIServer, { Route } from "~/toolset-rest-api-gateway-plugin/fastify/RestAPIServer";
import { dumpObject, thenChainEagerly } from "~/tools";

import { _createTargetedToMapping, _resolveMappingResource } from "./_mappingHandlerOps";

export default function createRouteHandler (server: RestAPIServer, route: Route) {
  return {
    category: "mapping", method: "DELETE", fastifyRoute: route,
    requiredRuntimeRules: ["resourceId", "mappingName", "targetId"],
    builtinRules: {
      mappingName: ["constant", route.config.mappingName],
    },
    prepare (/* fastify */) {
      this.scopeRules = server.prepareScopeRules(this);
      const { toMapping } = _createTargetedToMapping(server, route, ["~$:targetId"]);
      this.toMapping = toMapping;
      /*
      const toRelations = ["§->",
          ...route.config.mappingName.split("/").slice(0, -1).map(name => ["§..", name])];
      server.buildKuery(route.config.relationSchema, toRelations);
      toRelations.splice(-1);
      */
    },
    preload () {
      // const connection = await server.getDiscourse().acquireConnection(
      //    route.config.valos.subject, { newPartition: false }).asActiveConnection();
      // const vRoot = server.getEngine().getVrapper([connection.getPartitionRawId()]);
    },
    handleRequest (request, reply) {
      const scope = server.buildScope(request, this.scopeRules);
      server.infoEvent(1, () => [
        `${this.name}:`, scope.resourceId, scope.mappingName, scope.targetId,
        "\n\trequest.query:", request.query,
      ]);
      if (_resolveMappingResource(server, route, request, reply, scope)) return true;
      scope.mapping = scope.resource.get(this.toMapping, { scope });
      if (scope.mapping === undefined) {
        reply.code(404);
        reply.send(`No mapping '${route.config.mappingName}' found from ${
          scope.resourceId} to ${scope.targetId}`);
        return true;
      }

      const wrap = new Error(this.name);
      return thenChainEagerly(null, [
        () => scope.mapping.destroy(),
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
          "\n\tscope.mapping:", ...dumpObject(scope.mapping),
          "\n\tscope.resource:", ...dumpObject(scope.resource),
          "\n\tscopeRules:", ...dumpObject(this.scopeRules),
        );
      });
    }
  };
}
