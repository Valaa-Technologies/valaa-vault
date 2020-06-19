// @flow

import type { PrefixRouter, Route } from "~/web-spindle/MapperService";
import { thenChainEagerly } from "~/tools";

export default function createProjector (router: PrefixRouter, route: Route) {
  return {
    requiredRules: ["routeRoot", "name"],

    prepare () {
      this.runtime = router.createProjectorRuntime(this, route);
      this.toResponseContent = router.appendSchemaSteps(this.runtime, route.schema.response[200],
          { expandProperties: true });
    },

    preload () {
      return router.preloadRuntimeResources(this, this.runtime);
    },

    handler (request, reply) {
      const valkOptions = router.buildRuntimeVALKOptions(this, this.runtime, request, reply);
      const scope = valkOptions.scope;
      router.infoEvent(1, () => [
        `${this.name}:`, scope.name,
        "\n\trequest.query:", request.query,
      ]);
      scope.resource = router._engine.tryVrapper([scope.resourceId]);
      if (!scope.resource) {
        reply.code(404);
        reply.send(`No such ${route.config.resource.name} route resource: ${scope.resourceId}`);
        return true;
      }
      const { fields } = request.query;
      return thenChainEagerly(scope.resource, [
        vResource => vResource.step(this.toResponseContent, { scope, verbosity: 0 }),
        (fields) && (responseContent => router
            .pickResultFields(valkOptions, responseContent, fields, route.schema.response[200])),
        responseContent => router
            .fillReplyFromResponse(responseContent, this.runtime, valkOptions),
      ]);
    },
  };
}
