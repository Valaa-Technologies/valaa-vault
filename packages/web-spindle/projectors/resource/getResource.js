// @flow

import type { PrefixRouter, Route } from "~/web-spindle/MapperService";
import { dumpObject, thenChainEagerly } from "~/tools";

import { _presolveResourceRouteRequest } from "./_resourceHandlerOps";

export default function createProjector (router: PrefixRouter, route: Route) {
  return {
    requiredRules: ["routeRoot"],
    valueAssertedRules: ["resource"],

    prepare () {
      this.runtime = router.createProjectorRuntime(this, route);
      this.toResponseContent = ["§->"];
      router.appendSchemaSteps(this.runtime, route.schema.response[200],
          { expandProperties: true, targetTrack: this.toResponseContent });

      router.addResourceProjector(this);
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
        "\n\tresource:", ...dumpObject(scope.resource),
      ]);

      const { fields } = request.query;
      return thenChainEagerly(scope.resource, [
        vResource => vResource.step(this.toResponseContent, valkOptions),
        (fields) && (responseContent => router
            .pickResultFields(valkOptions, responseContent, fields, route.schema.response[200])),
        responseContent => router
            .fillReplyFromResponse(responseContent, this.runtime, valkOptions),
      ]);
    },
  };
}
