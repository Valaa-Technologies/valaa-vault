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
      this.toSuccessBodyFields = ["§->"];
      router.appendSchemaSteps(this.runtime, route.schema.response[200],
          { expandProperties: true, targetVAKON: this.toSuccessBodyFields });

      router.addResourceProjector(route, this);
    },

    preload () {
      return router.preloadRuntimeResources(this, this.runtime);
    },

    handler (request, reply) {
      const valkOptions = router.buildRuntimeVALKOptions(this, this.runtime, request, reply);
      if (_presolveResourceRouteRequest(router, route, this.runtime, valkOptions)) {
        return true;
      }
      const scope = valkOptions.scope;
      router.infoEvent(2, () => [
        `${this.name}:`, ...dumpObject(scope.resource),
        "\n\trequest.query:", ...dumpObject(request.query),
      ]);

      const { fields } = request.query;
      return thenChainEagerly(valkOptions.scope.resource, [
        vResource => vResource.get(this.toSuccessBodyFields, valkOptions),
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
