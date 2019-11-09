// @flow

import type { PrefixRouter, Route } from "~/rest-api-spindle/fastify/MapperService";
import { dumpObject, thenChainEagerly } from "~/tools";

import { _createToMapping, _presolveMappingRouteRequest } from "./_mappingHandlerOps";

export default function createProjector (router: PrefixRouter, route: Route) {
  return {
    requiredRules: ["routeRoot", "resource", "target"],
    rules: {
      mappingName: route && route.config.relation.name,
    },

    prepare () {
      this.runtime = router.createRouteRuntime(this);
      this.toMapping = _createToMapping(router, route, this.runtime);
      this.toSuccessBodyFields = router.appendSchemaSteps(this.runtime, route.schema.response[200],
        { expandProperties: true });
    },

    preload () {
      return router.preloadRuntimeResources(this, this.runtime);
    },

    handler (request, reply) {
      const valkOptions = router.buildRuntimeVALKOptions(this, this.runtime, request, reply);
      if (_presolveMappingRouteRequest(router, route, this.runtime, valkOptions, this.toMapping)) {
        return true;
      }
      const scope = valkOptions.scope;
      router.infoEvent(1, () => [
        `${this.name}:`, ...dumpObject(scope.resource),
        `\n\t${scope.mappingName}:`, ...dumpObject(scope.mapping),
        `\n\ttarget:`, ...dumpObject(scope.target),
        "\n\trequest.query:", request.query,
      ]);
      if (scope.mapping === undefined) {
        scope.reply.code(404);
        scope.reply.send(`No mapping '${route.config.relation.name}' found from ${
          scope.resource.getRawId()} to ${scope.target.getRawId()}`);
        return true;
      }

      const { fields } = request.query;
      return thenChainEagerly(scope.mapping, [
        vMapping => vMapping.get(this.toSuccessBodyFields, valkOptions),
        results => ((!fields || !results)
            ? results
            : router.pickResultFields(results, fields, route.schema.response[200])),
        results => {
          if (!results) {
            reply.code(404);
            reply.send(`No mapping '${route.config.relation.name}' found from route resource ${
              scope.resource.getRawId()} to ${scope.target.getRawId()}`);
            return true;
          }
          reply.code(200);
          reply.send(JSON.stringify(results, null, 2));
          router.infoEvent(2, () => [
            `${this.name}:`,
            "\n\tresults:", ...dumpObject(results),
          ]);
          return true;
        }
      ]);
    },
  };
}
