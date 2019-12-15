// @flow

import type { PrefixRouter, Route } from "~/rest-api-spindle/MapperService";

import { dumpObject, thenChainEagerly } from "~/tools";

import { _presolveRouteRequest } from "../_commonProjectorOps";

export default function createProjector (router: PrefixRouter, route: Route) {
  return {
    requiredRules: ["routeRoot"],

    prepare () {
      this.runtime = router.createProjectorRuntime(this);

      this.toSuccessBodyFields = ["§->"];
      router.appendGateProjectionSteps(
          this.runtime, route.config.resource, this.toSuccessBodyFields);
    },

    async preload () {
      await router.preloadRuntimeResources(this, this.runtime);
    },

    handler (request, reply) {
      const valkOptions = router.buildRuntimeVALKOptions(this, this.runtime, request, reply);
      const scope = valkOptions.scope;
      if (_presolveRouteRequest(router, route, this.runtime, valkOptions)) {
        return true;
      }
      router.infoEvent(1, () => [`${this.name}:`,
        "\n\trequest.query:", ...dumpObject(request.query),
      ]);
      const {
        filter, // unimplemented
        sort, offset, limit, ids,
        fields,
        // Assumes all remaining query params are field requirements.
        // Relies on schema validation to reject garbage params.
        ...fieldRequirements
      } = request.query;
      return thenChainEagerly(scope.routeRoot, [
        vRouteRoot => vRouteRoot.get(this.toSuccessBodyFields, valkOptions),
        (results => results
            .filter(e => e)),
        (filter || ids || Object.keys(fieldRequirements).length) && (results => router
            .filterResults(results, filter, ids, fieldRequirements)),
        (sort) && (results => router
            .sortResults(results, sort)),
        (offset || (limit !== undefined)) && (results => router
            .paginateResults(results, offset || 0, limit)),
        (fields) && (results => router
            .pickResultFields(valkOptions, results, fields, route.config.resource)),
        results => {
          router.infoEvent(2, () => [
            `${this.name}:`,
            "\n\tresults:", ...dumpObject(results),
          ]);
          reply.code(200);
          router.replySendJSON(reply, results);
          return true;
        },
      ]);
    },
  };
}
