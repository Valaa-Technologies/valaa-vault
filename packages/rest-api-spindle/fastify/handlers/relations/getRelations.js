// @flow

import type { PrefixRouter, Route } from "~/rest-api-spindle/fastify/MapperService";
import { dumpObject, thenChainEagerly } from "~/tools";

import { _presolveResourceRouteRequest } from "../resource/_resourceHandlerOps";

export default function createProjector (router: PrefixRouter, route: Route) {
  return {
    requiredRules: ["routeRoot", "resource"],

    prepare () {
      this.runtime = router.createRouteRuntime(this);
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
      const valkOptions = router.buildRuntimeVALKOptions(this, this.runtime, request, reply);
      if (_presolveResourceRouteRequest(router, route, this.runtime, valkOptions)) {
        return true;
      }
      const scope = valkOptions.scope;
      router.infoEvent(1, () => [
        `${this.name}:`, ...dumpObject(scope.resource),
        "\n\trequest.query:", request.query,
      ]);
      const { fields } = request.query;
      return thenChainEagerly(scope.resource, [
        vResource => vResource.get(this.toSuccessBodyFields, valkOptions),
        (fields) && (results =>
            router.pickResultFields(results, fields, route.schema.response[200])),
        results => {
          reply.code(200);
          reply.send(JSON.stringify(results, null, 2));
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
