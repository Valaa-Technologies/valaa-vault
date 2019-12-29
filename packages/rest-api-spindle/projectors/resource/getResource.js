// @flow

import type { PrefixRouter, Route } from "~/rest-api-spindle/MapperService";
import { dumpObject, thenChainEagerly } from "~/tools";

import { _presolveResourceRouteRequest } from "./_resourceHandlerOps";

export default function createProjector (router: PrefixRouter, route: Route) {
  return {
    requiredRules: ["routeRoot"],
    requiredRuntimeRules: ["resource"],

    prepare () {
      this.runtime = router.createProjectorRuntime(this);
      this.toResponseContent = ["§->"];
      router.appendSchemaSteps(this.runtime, route.schema.response[200],
          { expandProperties: true, targetVAKON: this.toResponseContent });

      router.addResourceProjector(route, this);
    },

    preload () {
      return router.preloadRuntimeResources(this, this.runtime);
    },

    handler (request, reply) {
      router.infoEvent(2, () => [`${this.name}:`,
        "\n\trequest.query:", ...dumpObject(request.query),
        "\n\trequest.cookies:", ...dumpObject(Object.keys(request.cookies || {})),
      ]);
      const valkOptions = router.buildRuntimeVALKOptions(this, this.runtime, request, reply);
      if (_presolveResourceRouteRequest(router, route, this.runtime, valkOptions)) {
        return true;
      }
      const scope = valkOptions.scope;
      router.infoEvent(2, () => [`${this.name}:`,
        "\n\tresource:", ...dumpObject(scope.resource),
      ]);

      const { fields } = request.query;
      return thenChainEagerly(scope.resource, [
        vResource => vResource.get(this.toResponseContent, valkOptions),
        (fields) && (responseContent => router
            .pickResultFields(valkOptions, responseContent, fields, route.schema.response[200])),
        responseContent => router
            .fillReplyFromResponse(responseContent, this.runtime, valkOptions),
      ]);
    },
  };
}
