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
      const fromEntry = router.appendGateSteps(
          this.runtime, route.config.resource.gate, this.toSuccessBodyFields);
      router.appendSchemaSteps(this.runtime, route.schema.response[200],
          { expandProperties: true, targetVAKON: fromEntry });
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
      router.infoEvent(1, () => [
        `${this.name}:`,
        "\n\trequest.query:", ...dumpObject(request.query),
        "\n\troute.config:", ...dumpObject(route.config),
        "\n\troute.schema.response[200]:", ...dumpObject(route.schema.response[200]),
        "\n\ttoSuccessBodyFields:", ...dumpObject(this.toSuccessBodyFields),
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
        (filter || ids || Object.keys(fieldRequirements).length)
            && (results => router.filterResults(results, filter, ids, fieldRequirements)),
        (sort)
            && (results => router.sortResults(results, sort)),
        (offset || (limit !== undefined))
            && (results => router.paginateResults(results, offset || 0, limit)),
        (fields)
            && (results => router.pickResultFields(results, fields, route.schema.response[200])),
        results => JSON.stringify(results, null, 2),
        results => {
          router.infoEvent(2, () => [
            `${this.name}:`,
            "\n\tresults:", ...dumpObject(results),
          ]);
          reply.code(200);
          reply.send(results);
          return true;
        },
      ]);
    },
  };
}
