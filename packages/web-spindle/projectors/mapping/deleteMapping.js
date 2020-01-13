// @flow

import type { PrefixRouter, Route } from "~/web-spindle/MapperService";
import { dumpObject, thenChainEagerly } from "~/tools";

import { _createToMapping, _presolveMappingRouteRequest } from "./_mappingHandlerOps";

export default function createProjector (router: PrefixRouter, route: Route) {
  return {
    requiredRules: ["routeRoot", "mappingName"],
    runtimeRules: ["doDestroyMapping"],
    valueAssertedRules: ["resource", "target"],

    prepare () {
      this.runtime = router.createProjectorRuntime(this, route);
      _createToMapping(router, route, this.runtime);
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
      const scope = valkOptions.scope;
      if (_presolveMappingRouteRequest(router, this.runtime, valkOptions)) {
        return true;
      }
      router.infoEvent(2, () => [`${this.name}:`,
        "\n\tresource:", ...dumpObject(scope.resource),
        `\n\t${scope.mappingName}:`, ...dumpObject(scope.mapping),
        `\n\ttarget:`, ...dumpObject(scope.target),
        "\n\tresolvers:", ...dumpObject(this.runtime.ruleResolvers),
      ]);
      if (scope.mapping === undefined) {
        scope.reply.code(404);
        scope.reply.send(`No mapping '${scope.mappingName}' found from ${
          scope.resource.getRawId()} to ${scope.target.getRawId()}`);
        return true;
      }
      const { doDestroyMapping } = this.runtime.ruleResolvers;

      const wrap = new Error(this.name);
      valkOptions.discourse = router.getDiscourse().acquireFabricator();
      return thenChainEagerly(scope.mapping, [
        vMapping => (doDestroyMapping
            ? router.resolveToScope("destruction", doDestroyMapping, vMapping, valkOptions)
            : vMapping.destroy(valkOptions)),
        () => valkOptions.discourse.releaseFabricator(),
        eventResult => eventResult && eventResult.getPersistedEvent(),
        event => {
          reply.code(event ? 204 : 404);
          reply.send();
          router.infoEvent(2, () => [`${this.name}`]);
          return true;
        },
      ], (error) => {
        if (valkOptions.discourse.isActiveFabricator()) {
          valkOptions.discourse.releaseFabricator({ abort: error });
        }
        throw router.wrapErrorEvent(error, 1, wrap,
          "\n\trequest.query:", ...dumpObject(request.query),
          "\n\tscope.mapping:", ...dumpObject(scope.mapping),
          "\n\tscope.resource:", ...dumpObject(scope.resource),
          "\n\truntime:", ...dumpObject(this.runtime),
          "\n\tresolvers:", ...dumpObject(this.runtime.ruleResolvers),
        );
      });
    }
  };
}
