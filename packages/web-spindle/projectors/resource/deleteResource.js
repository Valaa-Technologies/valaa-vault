// @flow

import type { PrefixRouter, Route } from "~/web-spindle/MapperService";
import { dumpObject, thenChainEagerly } from "~/tools";
import { _presolveResourceRouteRequest } from "./_resourceHandlerOps";

export default function createProjector (router: PrefixRouter, route: Route) {
  return {
    requiredRules: ["routeRoot"],
    runtimeRules: ["doDeleteResource"],
    valueAssertedRules: ["resource"],

    prepare () {
      this.runtime = router.createProjectorRuntime(this, route);
    },

    preload () {
      return router.preloadRuntimeResources(this, this.runtime);
    },

    handler (request, reply) {
      router.infoEvent(1, () => [`${this.name}:`,
        "\n\trequest.params:", ...dumpObject(request.params),
        "\n\trequest.query:", ...dumpObject(request.query),
        "\n\trequest.cookies:", ...dumpObject(Object.keys(request.cookies || {})),
      ]);
      const valkOptions = router.buildRuntimeVALKOptions(this, this.runtime, request, reply);
      if (_presolveResourceRouteRequest(router, this.runtime, valkOptions)) {
        return true;
      }
      const scope = valkOptions.scope;
      router.infoEvent(2, () => [`${this.name}:`,
        "\n\tresolvers:", ...dumpObject(this.runtime.resolvers),
        "\n\tresource:", ...dumpObject(scope.resource),
      ]);
      const { doDeleteResource } = this.runtime.resolvers;

      const wrap = new Error(this.name);
      valkOptions.discourse = router.getDiscourse().acquireFabricator();
      return thenChainEagerly(valkOptions.discourse, [
        () => (doDeleteResource
            ? router.resolveToScope("deletion", doDeleteResource, scope.resource, valkOptions)
            : scope.resource.destroy(valkOptions)),
        () => valkOptions.discourse.releaseFabricator(),
        eventResult => eventResult
            && eventResult.getPersistedEvent(),
        () => {
          reply.code(204);
          reply.send();
          router.infoEvent(2, () => [
            `${this.name}:`, ...dumpObject(scope.resource),
          ]);
          return true;
        },
      ], (error) => {
        if (valkOptions.discourse.isActiveFabricator()) {
          valkOptions.discourse.releaseFabricator({ abort: error });
        }
        throw router.wrapErrorEvent(error, wrap,
          "\n\trequest.query:", ...dumpObject(request.query),
          "\n\tscope.resource:", ...dumpObject(scope.resource),
          "\n\tprojectorRuntime:", ...dumpObject(this.runtime),
        );
      });
    },
  };
}
