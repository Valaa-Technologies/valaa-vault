// @flow

import type MapperService, { Route } from "~/rest-api-spindle/fastify/MapperService";
import { dumpObject, thenChainEagerly } from "~/tools";

import { _createTargetedToMapping, _resolveMappingResource } from "./_mappingHandlerOps";

export default function createRouter (mapper: MapperService, route: Route) {
  return {
    requiredRules: ["routeRoot", "resource", "target", "destroyMapping"],
    rules: {
      mappingName: route && route.config.relation.name,
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
      const valkOptions = mapper.buildRuntimeVALKOptions(this, this.runtime, request, reply);
      const scope = valkOptions.scope;
      mapper.infoEvent(1, () => [
        `${this.name}:`, ...dumpObject(scope.resource),
        `\n\t${scope.mappingName}:`, ...dumpObject(scope.mapping),
        `\n\ttarget:`, ...dumpObject(scope.target),
        "\n\trequest.query:", request.query,
      ]);
      if (_resolveMappingResource(mapper, route, request, reply, scope)) return true;
      scope.mapping = scope.resource.get(this.toMapping, { scope });
      if (scope.mapping === undefined) {
        scope.reply.code(404);
        scope.reply.send(`No mapping '${route.config.relation.name}' found from ${
          scope.resource.getRawId()} to ${scope.target.getRawId()}`);
        return true;
      }

      const wrap = new Error(this.name);
      valkOptions.discourse = mapper.getDiscourse().acquireFabricator();
      return thenChainEagerly(scope.mapping, [
        vMapping => (scope.destroyMapping
            ? vMapping.do(scope.destroyMapping, valkOptions)
            : vMapping.destroy(valkOptions)),
        () => valkOptions.discourse.releaseFabricator(),
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
        valkOptions.discourse.releaseFabricator({ abort: error });
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
