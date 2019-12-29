// @flow

import type { PrefixRouter, Route } from "~/rest-api-spindle/MapperService";

import { dumpObject, thenChainEagerly } from "~/tools";

import { _presolveRouteRequest } from "../_commonProjectorOps";

export default function createProjector (router: PrefixRouter, route: Route) {
  return {
    requiredRules: ["routeRoot"],

    prepare () {
      this.runtime = router.createProjectorRuntime(this);

      this.toResponseContent = ["§->"];
      router.appendGateProjectionSteps(
          this.runtime, route.config.resource, this.toResponseContent);
      this.toListingResources = this.toResponseContent.slice(0, -1);
      this.toListingResources.push(["§map", "target"]);
    },

    async preload () {
      await router.preloadRuntimeResources(this, this.runtime);
      const preloadOptions = router.buildRuntimeVALKOptions(this, this.runtime, null, null);
      if (_presolveRouteRequest(router, route, this.runtime, preloadOptions)) return;
      // if runtime rules fail just skip preload
      let activations = [];
      this.runtime.subscription = preloadOptions.scope.routeRoot
          .obtainSubscription(this.toListingResources, preloadOptions);
      this.runtime.subscription
          .addListenerCallback(this.runtime, "fields", update => {
            const newActivations = [];
            for (const newEntry of update.actualAdds()) {
              const activation = newEntry && newEntry.activate();
              if (activation) newActivations.push(activation);
            }
            router.infoEvent(1, () => [
              "route listing", router._routeName(route),
              "\n\tgot", update.actualAdds().length, "new entries, of which",
                  newActivations.length, "new activations",
            ]);
            activations = newActivations;
          });
      await Promise.all(activations);
    },

    handler (request, reply) {
      router.infoEvent(1, () => [`${this.name}:`,
        "\n\trequest.query:", ...dumpObject(request.query),
        "\n\trequest.cookies:", ...dumpObject(Object.keys(request.cookies || {})),
      ]);
      const valkOptions = router.buildRuntimeVALKOptions(this, this.runtime, request, reply);
      const scope = valkOptions.scope;
      if (_presolveRouteRequest(router, route, this.runtime, valkOptions)) {
        return true;
      }
      const {
        filter, // unimplemented
        sort, offset, limit, ids,
        fields,
        // Assumes all remaining query params are field requirements.
        // Relies on schema validation to reject garbage params.
        ...fieldRequirements
      } = request.query;
      return thenChainEagerly(scope.routeRoot, [
        vRouteRoot => vRouteRoot.get(this.toResponseContent, valkOptions),
        (responseContent => responseContent
            .filter(e => e)),
        (filter || ids || Object.keys(fieldRequirements).length) && (responseContent => router
            .filterResults(responseContent, filter, ids, fieldRequirements)),
        (sort) && (responseContent => router
            .sortResults(responseContent, sort)),
        (offset || (limit !== undefined)) && (responseContent => router
            .paginateResults(responseContent, offset || 0, limit)),
        (fields) && (responseContent => router
            .pickResultFields(valkOptions, responseContent, fields, route.config.resource)),
        responseContent => router
            .fillReplyFromResponse(responseContent, this.runtime, valkOptions),
      ]);
    },
  };
}
