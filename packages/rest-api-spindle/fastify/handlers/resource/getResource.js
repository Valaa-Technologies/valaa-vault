// @flow

import type MapperService, { Route } from "~/rest-api-spindle/fastify/MapperService";
import { dumpObject, thenChainEagerly } from "~/tools";

import { _verifyResourceAuthorization } from "./_resourceHandlerOps";

export default function createRouter (mapper: MapperService, route: Route) {
  return {
    requiredRules: ["routeRoot", "resource"],

    prepare (/* fastify */) {
      this.runtime = mapper.createRouteRuntime(this);
      this.toResourceFields = ["§->"];
      mapper.buildKuery(route.schema.response[200], this.toResourceFields);
      this.hardcodedResources = route.config.valos.hardcodedResources;
    },

    preload () {
      return mapper.preloadRuntimeResources(this, this.runtime);
    },

    handler (request, reply) {
      const { scope } = mapper.buildRuntimeVALKOptions(this, this.runtime, request, reply);
      mapper.infoEvent(2, () => [
        `${this.name}:`, scope.resourceId,
        "\n\trequest.query:", request.query,
      ]);
      if (_verifyResourceAuthorization(mapper, route, request, reply, scope)) return true;
      scope.resource = mapper._engine.tryVrapper([scope.resourceId]);
      if (!scope.resource) {
        reply.code(404);
        reply.send(`No such ${route.config.resourceTypeName} route resource: ${scope.resourceId}`);
        return true;
      }
      const { fields } = request.query;
      return thenChainEagerly(scope.resource, [
        vResource => vResource.get(this.toResourceFields, { scope, verbosity: 0 })
            || this.hardcodedResources[scope.resourceId],
        (fields)
            && (results => mapper.pickResultFields(results, fields, route.schema.response[200])),
        results => {
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
