// @flow

import type MapperService, { Route } from "~/rest-api-spindle/fastify/MapperService";
import { dumpObject, thenChainEagerly } from "~/tools";

import { _verifyResourceAuthorization } from "./_resourceHandlerOps";

export default function createRouter (mapper: MapperService, route: Route) {
  return {
    requiredRules: ["routeRoot", "resource"],

    prepare (/* fastify */) {
      this.runtime = mapper.createRouteRuntime(this);
      this.toSuccessBodyFields = mapper.buildSchemaKuery(route.schema.response[200]);
      this.hardcodedResources = route.config.valos.hardcodedResources;
    },

    preload () {
      return mapper.preloadRuntimeResources(this, this.runtime);
    },

    handler (request, reply) {
      const valkOptions = mapper.buildRuntimeVALKOptions(this, this.runtime, request, reply);
      if (_verifyResourceAuthorization(mapper, route, request, reply, scope)) return true;
      scope.resource = mapper._engine.tryVrapper([scope.resourceId]);
      if (!scope.resource) {
        reply.code(404);
        reply.send(`No such ${route.config.resourceTypeName} route resource: ${scope.resourceId}`);
        return true;
      }
      const scope = valkOptions.scope;
      mapper.infoEvent(2, () => [
        `${this.name}:`, ...dumpObject(scope.resource),
        "\n\trequest.query:", ...dumpObject(request.query),
      ]);

      const { fields } = request.query;
      return thenChainEagerly(valkOptions.scope.resource, [
        vResource => vResource.get(this.toSuccessBodyFields, valkOptions),
        (fields) && (results =>
            mapper.pickResultFields(results, fields, route.schema.response[200])),
        results => {
          reply.code(200);
          reply.send(JSON.stringify(results, null, 2));
          mapper.infoEvent(2, () => [
            `${this.name}:`, ...dumpObject(scope.resource),
            "\n\tresults:", ...dumpObject(results),
          ]);
          return true;
        }
      ]);
    },
  };
}
