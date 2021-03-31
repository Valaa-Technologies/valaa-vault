// @flow

import type { PrefixRouter, Route } from "~/web-spindle/MapperService";
import { dumpObject, thenChainEagerly } from "~/tools";

import { _presolveResourceRouteRequest } from "./_resourceHandlerOps";

export default function createProjector (router: PrefixRouter, route: Route) {
  return {
    requiredRules: ["routeRoot"],
    runtimeRules: ["doPatchResource"],
    valueAssertedRules: ["resource"],

    prepare () {
      this.runtime = router.createProjectorRuntime(this, route);
      this.toPatchTarget = router.appendSchemaSteps(this.runtime, route.config.resource.schema);
      if (this.toPatchTarget.length <= 1) this.toPatchTarget = undefined;
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
      if (!_presolveResourceRouteRequest(router, this.runtime, valkOptions)) {
        return true;
      }
      const scope = valkOptions.scope;
      router.infoEvent(2, () => [`${this.name}:`,
        "\n\trequest.body:", ...dumpObject(request.body),
        "\n\tresolvers:", ...dumpObject(this.runtime.ruleResolvers),
        "\n\tresource:", ...dumpObject(scope.resource),
      ]);
      const { doPatchResource } = this.runtime.ruleResolvers;

      valkOptions.discourse = router.getDiscourse().acquireFabricator();
      return thenChainEagerly(scope.resource, [
        () => (doPatchResource
            ? router.resolveToScope("patching", doPatchResource, scope.resource, valkOptions)
            : router.updateResource(scope.resource, request.body,
                { ...valkOptions, route, toPatchTarget: this.toPatchTarget })),
        () => valkOptions.discourse.releaseFabricator(),
        eventResult => eventResult && eventResult.getRecordedEvent(),
        (persistedEvent) => {
          const results = persistedEvent ? "UPDATED" : "UNCHANGED";
          reply.code(204);
          reply.send();
          router.infoEvent(2, () => [
            `${this.name}:`,
            "\n\tresults:", ...dumpObject(results),
          ]);
          return true;
        },
      ], (error) => {
        if (valkOptions.discourse.isActiveFabricator()) {
          valkOptions.discourse.releaseFabricator({ abort: error });
        }
        throw router.wrapErrorEvent(error, 1, error.chainContextName(this.name),
          "\n\trequest.query:", ...dumpObject(request.query),
          "\n\trequest.body:", ...dumpObject(request.body),
          "\n\tscope.resource:", ...dumpObject(scope.resource),
          "\n\tprojectorRuntime:", ...dumpObject(this.runtime),
        );
      });
    },
  };
}
