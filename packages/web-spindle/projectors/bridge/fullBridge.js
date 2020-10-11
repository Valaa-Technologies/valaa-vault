// @flow

import type { PrefixRouter, Route } from "~/web-spindle/MapperService";
import { dumpObject, thenChainEagerly } from "~/tools";

import { _presolveRouteRequest } from "../_commonProjectorOps";

export default function createProjector (router: PrefixRouter, route: Route) {
  return {
    requiredRules: ["routeRoot"],
    runtimeRules: ["response"],

    prepare () {
      this.runtime = router.createProjectorRuntime(this, route);
      this.runtime.scopePreparations.route = route;
    },

    preload () {
      return router.preloadRuntimeResources(this, this.runtime);
    },

    handler (request, reply) {
      router.infoEvent(1, () => [`${this.name}:`,
        "\n\trequest.params:", ...dumpObject(request.params),
        "\n\trequest.query:", ...dumpObject(request.query),
        "\n\trequest.cookies:", ...dumpObject(Object.keys(request.cookies || {})),
        "\n\trequest.body:", ...dumpObject((typeof request.body !== "object") ? request.body
            : Object.keys(request.body || {})),
      ]);
      const valkOptions = router.buildRuntimeVALKOptions(this, this.runtime, request, reply);
      if (!_presolveRouteRequest(router, this.runtime, valkOptions)) {
        return true;
      }
      router.infoEvent(2, () => [`${this.name}:`,
        "\n\trequest.cookies:", ...dumpObject(request.cookies),
        "\n\trequest.body:", ...dumpObject(request.body),
        "\n\tresolvers:", ...dumpObject(this.runtime.ruleResolvers),
      ]);
      const { response } = this.runtime.ruleResolvers;

      const wrap = new Error(`bridge ${route.method} ${route.url}`);
      valkOptions.discourse = router.getDiscourse().acquireFabricator();
      return thenChainEagerly(valkOptions.scope.routeRoot, [
        vRouteRoot => router.resolveToScope("response", response, vRouteRoot, valkOptions),
        () => valkOptions.discourse.releaseFabricator(),
        eventResult => eventResult && eventResult.getRecordedEvent(),
        (/* persistedEvent */) => router
            .fillReplyFromResponse(valkOptions.scope.response, this.runtime, valkOptions),
      ], (error) => {
        if (valkOptions.discourse && valkOptions.discourse.isActiveFabricator()) {
          valkOptions.discourse.releaseFabricator({ abort: error });
        }
        throw router.wrapErrorEvent(error, 1, wrap,
            "\n\trequest.query:", ...dumpObject(request.query),
            "\n\trequest.cookies:", ...dumpObject(Object.keys(request.cookies || {})),
            "\n\trequest.body:", ...dumpObject(request.body),
            "\n\tprojectorRuntime:", ...dumpObject(this.runtime),
        );
      });
    },
  };
}
