// @flow

import type { PrefixRouter, Route } from "~/web-spindle/MapperService";
import { dumpObject, thenChainEagerly } from "~/tools";

import { _presolveResourceRouteRequest } from "../resource/_resourceHandlerOps";

export default function createProjector (router: PrefixRouter, route: Route) {
  return {
    requiredRules: ["routeRoot"],
    valueAssertedRules: ["resource"],

    prepare () {
      this.runtime = router.createProjectorRuntime(this, route);
      this.toResponseContent = ["§->"];
      router.appendSchemaSteps(this.runtime, route.config.resource.schema,
          { targetTrack: this.toResponseContent });
      router.appendSchemaSteps(this.runtime, route.schema.response[200],
          { expandProperties: true, targetTrack: this.toResponseContent });
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
      if (!_presolveResourceRouteRequest(router, this.runtime, valkOptions)) {
        return true;
      }
      router.infoEvent(2, () => [`${this.name}:`,
        "\n\tresource:", ...dumpObject(scope.resource),
      ]);
      const {
        filter, sort, offset, limit, ids, fields,
        ...fieldRequirements
      } = request.query;
      return thenChainEagerly(scope.resource, [
        vResource => vResource.get(this.toResponseContent, valkOptions),
        (filter || ids || Object.keys(fieldRequirements).length) && (responseContent => router
            .filterResults(responseContent, filter, ids, fieldRequirements)),
        (sort) && (responseContent => router
            .sortResults(responseContent, sort)),
        (offset || (limit !== undefined)) && (responseContent => router
            .paginateResults(responseContent, offset || 0, limit)),
        (fields) && (responseContent => router
            .pickResultFields(valkOptions, responseContent, fields, route.schema.response[200])),
        responseContent => router
            .fillReplyFromResponse(responseContent, this.runtime, valkOptions),
      ]);
    },
  };
}
