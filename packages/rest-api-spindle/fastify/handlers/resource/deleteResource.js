// @flow

import type { PrefixRouter, Route } from "~/rest-api-spindle/fastify/MapperService";
import { dumpObject, thenChainEagerly } from "~/tools";
import { _presolveResourceRouteRequest } from "./_resourceHandlerOps";

export default function createProjector (router: PrefixRouter, route: Route) {
  return {
    requiredRules: ["routeRoot", "resource", "doDeleteResource"],

    prepare () {
      this.runtime = router.createRouteRuntime(this);
    },

    preload () {
      return router.preloadRuntimeResources(this, this.runtime);
    },

    handler (request, reply) {
      const valkOptions = router.buildRuntimeVALKOptions(this, this.runtime, request, reply);
      if (_presolveResourceRouteRequest(router, route, this.runtime, valkOptions)) {
        return true;
      }
      const scope = valkOptions.scope;
      router.infoEvent(1, () => [
        `${this.name}:`, ...dumpObject(scope.resource),
        "\n\trequest.query:", ...dumpObject(request.query),
      ]);
      const wrap = new Error(this.name);
      valkOptions.discourse = router.getDiscourse().acquireFabricator();
      return thenChainEagerly(valkOptions.discourse, [
        () => (scope.doDeleteResource
            ? scope.resource.do(scope.doDeleteResource, valkOptions)
            : scope.resource.destroy(valkOptions)),
        () => valkOptions.discourse.releaseFabricator(),
        eventResult => eventResult
            && eventResult.getPersistedEvent(),
        () => {
          const results = "DESTROYED";
          reply.code(200);
          reply.send(results);
          router.infoEvent(2, () => [
            `${this.name}:`, ...dumpObject(scope.resource),
            "\n\tresults:", ...dumpObject(results),
          ]);
          return true;
        },
      ], (error) => {
        valkOptions.discourse.releaseFabricator({ abort: error });
        throw router.wrapErrorEvent(error, wrap,
          "\n\trequest.query:", ...dumpObject(request.query),
          "\n\tscope.resource:", ...dumpObject(scope.resource),
          "\n\trouteRuntime:", ...dumpObject(this.runtime),
        );
      });
    },
  };
}
