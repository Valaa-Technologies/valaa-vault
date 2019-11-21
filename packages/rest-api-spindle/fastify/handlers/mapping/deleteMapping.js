// @flow

import type { PrefixRouter, Route } from "~/rest-api-spindle/fastify/MapperService";
import { dumpObject, thenChainEagerly } from "~/tools";

import { _createToMapping, _presolveMappingRouteRequest } from "./_mappingHandlerOps";

export default function createProjector (router: PrefixRouter, route: Route) {
  return {
    requiredRules: ["routeRoot", "resource", "target", "doDestroyMapping"],
    rules: {
      mappingName: route && route.config.relation.name,
    },

    prepare () {
      this.runtime = router.createRouteRuntime(this);
      this.toMapping = _createToMapping(router, route, this.runtime);
    },

    preload () {
      return router.preloadRuntimeResources(this, this.runtime);
    },

    handler (request, reply) {
      const valkOptions = router.buildRuntimeVALKOptions(this, this.runtime, request, reply);
      if (_presolveMappingRouteRequest(router, route, this.runtime, valkOptions, this.toMapping)) {
        return true;
      }
      const scope = valkOptions.scope;
      router.infoEvent(1, () => [
        `${this.name}:`, ...dumpObject(scope.resource),
        `\n\t${scope.mappingName}:`, ...dumpObject(scope.mapping),
        `\n\ttarget:`, ...dumpObject(scope.target),
        "\n\trequest.query:", request.query,
      ]);
      if (scope.mapping === undefined) {
        scope.reply.code(404);
        scope.reply.send(`No mapping '${route.config.relation.name}' found from ${
          scope.resource.getRawId()} to ${scope.target.getRawId()}`);
        return true;
      }

      const wrap = new Error(this.name);
      valkOptions.discourse = router.getDiscourse().acquireFabricator();
      return thenChainEagerly(scope.mapping, [
        vMapping => (scope.doDestroyMapping
            ? vMapping.do(scope.doDestroyMapping, valkOptions)
            : vMapping.destroy(valkOptions)),
        () => valkOptions.discourse.releaseFabricator(),
        eventResult => eventResult.getPersistedEvent(),
        () => {
          const results = "DESTROYED";
          reply.code(200);
          reply.send(results);
          router.infoEvent(2, () => [
            `${this.name}:`,
            "\n\tresults:", ...dumpObject(results),
          ]);
          return true;
        },
      ], (error) => {
        valkOptions.discourse.releaseFabricator({ abort: error });
        throw router.wrapErrorEvent(error, wrap,
          "\n\trequest.query:", ...dumpObject(request.query),
          "\n\tscope.mapping:", ...dumpObject(scope.mapping),
          "\n\tscope.resource:", ...dumpObject(scope.resource),
          "\n\trouteRuntime:", ...dumpObject(this.runtime),
        );
      });
    }
  };
}
