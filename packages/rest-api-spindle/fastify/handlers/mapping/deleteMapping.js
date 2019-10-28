// @flow

import type MapperService, { Route } from "~/rest-api-spindle/fastify/MapperService";
import { dumpObject, thenChainEagerly } from "~/tools";

import { _createTargetedToMapping, _resolveMappingResource } from "./_mappingHandlerOps";

export default function createRouter (mapper: MapperService, route: Route) {
  return {
    requiredRules: ["routeRoot", "resource", "target"],
    rules: {
      mappingName: route && route.config.mapping.name,
    },

    prepare (/* fastify */) {
      this.runtime = mapper.createRouteRuntime(this);
      const { toMapping } = _createTargetedToMapping(mapper, route, ["~$:targetId"]);
      this.toMapping = toMapping;
      /*
      const toRelations = mapper.buildSchemaKuery(route.config.mapping.schema, [
        "§->",
        ...route.config.mapping.name.split("/").slice(0, -1).map(name => ["§..", name]),
      ]);
      toRelations.splice(-1);
      */
    },

    preload () {
      return mapper.preloadRuntimeResources(this, this.runtime);
    },

    handler (request, reply) {
      const { scope } = mapper.buildRuntimeVALKOptions(this, this.runtime, request, reply);
      mapper.infoEvent(1, () => [
        `${this.name}:`, scope.resourceId, scope.mappingName, scope.targetId,
        "\n\trequest.query:", request.query,
      ]);
      if (_resolveMappingResource(mapper, route, request, reply, scope)) return true;
      scope.mapping = scope.resource.get(this.toMapping, { scope });
      if (scope.mapping === undefined) {
        reply.code(404);
        reply.send(`No mapping '${route.config.mapping.name}' found from ${
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
          mapper.infoEvent(2, () => [
            `${this.name}:`,
            "\n\tresults:", ...dumpObject(results),
          ]);
          return true;
        },
      ], (error) => {
        throw mapper.wrapErrorEvent(error, wrap,
          "\n\trequest.query:", ...dumpObject(request.query),
          "\n\tscope.mapping:", ...dumpObject(scope.mapping),
          "\n\tscope.resource:", ...dumpObject(scope.resource),
          "\n\trouteRuntime:", ...dumpObject(this.runtime),
        );
      });
    }
  };
}
