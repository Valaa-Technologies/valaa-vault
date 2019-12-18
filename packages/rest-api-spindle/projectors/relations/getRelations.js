// @flow

import type { PrefixRouter, Route } from "~/rest-api-spindle/MapperService";
import { dumpObject, thenChainEagerly } from "~/tools";

import { _presolveResourceRouteRequest } from "../resource/_resourceHandlerOps";

export default function createProjector (router: PrefixRouter, route: Route) {
  return {
    requiredRules: ["routeRoot"],
    requiredRuntimeRules: ["resource"],

    prepare () {
      this.runtime = router.createProjectorRuntime(this);
      this.toSuccessBodyFields = ["§->"];
      router.appendSchemaSteps(this.runtime, route.config.resource.schema,
          { targetVAKON: this.toSuccessBodyFields });
      router.appendSchemaSteps(this.runtime, route.schema.response[200],
          { expandProperties: true, targetVAKON: this.toSuccessBodyFields });
    },

    preload () {
      return router.preloadRuntimeResources(this, this.runtime);
    },

    handler (request, reply) {
      router.infoEvent(1, () => [`${this.name}:`,
        "\n\trequest.query:", ...dumpObject(request.query),
        "\n\trequest.cookies:", ...dumpObject(Object.keys(request.cookies || {})),
      ]);
      const valkOptions = router.buildRuntimeVALKOptions(this, this.runtime, request, reply);
      const scope = valkOptions.scope;
      if (_presolveResourceRouteRequest(router, route, this.runtime, valkOptions)) {
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
        vResource => vResource.get(this.toSuccessBodyFields, valkOptions),
        (filter || ids || Object.keys(fieldRequirements).length) && (results => router
            .filterResults(results, filter, ids, fieldRequirements)),
        (sort) && (results => router
            .sortResults(results, sort)),
        (offset || (limit !== undefined)) && (results => router
            .paginateResults(results, offset || 0, limit)),
        (fields) && (results => router
            .pickResultFields(valkOptions, results, fields, route.schema.response[200])),
        results => {
          reply.code(200);
          router.replySendJSON(reply, results);
          router.infoEvent(2, () => [
            `${this.name}:`, ...dumpObject(scope.resource),
            "\n\tresults:", ...dumpObject(results),
          ]);
          return true;
        }
      ]);
    },
  };
}
