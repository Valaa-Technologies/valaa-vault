// @flow

import type MapperService, { Route } from "~/rest-api-spindle/fastify/MapperService";
import { dumpObject, thenChainEagerly } from "~/tools";

import { _createTargetedToMappingFields, _resolveMappingResource } from "./_mappingHandlerOps";

export default function createRouter (mapper: MapperService, route: Route) {
  return {
    requiredRules: ["routeRoot", "resource", "target"],
    rules: {
      mappingName: route && route.config.mapping.name,
    },

    prepare (/* fastify */) {
      this.runtime = mapper.createRouteRuntime(this);
      this.toSuccessBodyFields = _createTargetedToMappingFields(mapper, route, ["~$:targetId"])
          .toMappingFields;
    },

    preload () {
      return mapper.preloadRuntimeResources(this, this.runtime);
    },

    handler (request, reply) {
      const { scope } = mapper.buildRuntimeVALKOptions(this, this.runtime, request, reply);
      mapper.infoEvent(1, () => [
        `${this.name}:`, scope.resourceId, scope.mappingName, scope.targetId,
        "\n\trequest.query:", request.query,
      ]);
      if (_resolveMappingResource(mapper, route, request, reply, scope)) return true;

      const { fields } = request.query;
      return thenChainEagerly(scope.resource, [
        vResource => vResource.get(this.toSuccessBodyFields, { scope, verbosity: 0 }),
        results => ((!fields || !results)
            ? results
            : mapper.pickResultFields(results, fields, route.schema.response[200])),
        results => {
          if (!results) {
            reply.code(404);
            reply.send(`No mapping '${route.config.mapping.name}' found from route resource ${
              scope.resourceId} to ${scope.targetId}`);
            return true;
          }
          reply.code(200);
          reply.send(JSON.stringify(results, null, 2));
          mapper.infoEvent(2, () => [
            `${this.name}:`,
            "\n\tresults:", ...dumpObject(results),
          ]);
          return true;
        }
      ]);
    },
  };
}
