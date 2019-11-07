// @flow

import type MapperService, { Route } from "~/rest-api-spindle/fastify/MapperService";
import { dumpObject, thenChainEagerly } from "~/tools";

import { _createToMapping, _presolveMappingRouteRequest } from "./_mappingHandlerOps";

export default function createRouter (mapper: MapperService, route: Route) {
  return {
    requiredRules: ["routeRoot", "resource", "target"],
    rules: {
      mappingName: route && route.config.relation.name,
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
      const valkOptions = mapper.buildRuntimeVALKOptions(this, this.runtime, request, reply);
      if (_presolveMappingRouteRequest(mapper, route, this.runtime, valkOptions, this.toMapping)) {
        return true;
      }
      const scope = valkOptions.scope;
      mapper.infoEvent(1, () => [
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
      return thenChainEagerly(scope.resource, [
        vMapping => vMapping.get(this.toSuccessBodyFields, valkOptions),
        results => ((!fields || !results)
            ? results
            : mapper.pickResultFields(results, fields, route.schema.response[200])),
        results => {
          if (!results) {
            reply.code(404);
            reply.send(`No mapping '${route.config.relation.name}' found from route resource ${
              scope.resource.getRawId()} to ${scope.target.getRawId()}`);
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
