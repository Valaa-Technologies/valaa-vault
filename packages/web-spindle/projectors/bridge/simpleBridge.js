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
      ]);
      const valkOptions = router.buildRuntimeVALKOptions(this, this.runtime, request, reply);
      if (_presolveRouteRequest(router, this.runtime, valkOptions)) {
        return true;
      }
      router.infoEvent(2, () => [`${this.name}:`,
        "\n\tresolvers:", ...dumpObject(this.runtime.ruleResolvers),
      ]);
      const { response } = this.runtime.ruleResolvers;
      return thenChainEagerly(valkOptions.scope.routeRoot, [
        vRouteRoot => router.resolveToScope("response", response, vRouteRoot, valkOptions),
        responseContent => router
            .fillReplyFromResponse(responseContent, this.runtime, valkOptions),
      ]);
    },
  };
}
