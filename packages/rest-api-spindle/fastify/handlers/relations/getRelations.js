// @flow

import type MapperService, { Route } from "~/rest-api-spindle/fastify/MapperService";
import { dumpObject, thenChainEagerly } from "~/tools";

import { _addToRelationsSourceSteps } from "../_handlerOps";

export default function createRouteHandler (mapper: MapperService, route: Route) {
  return {
    category: "relations", method: "GET", fastifyRoute: route,
    requiredRuntimeRules: ["resourceId"],
    builtinRules: {},
    prepare (/* fastify */) {
      this.routeRuntime = mapper.createRouteRuntime(this);
      this.toRelationsFields = ["§->"];
      _addToRelationsSourceSteps(mapper, route.config.resourceSchema, route.config.relationName,
          this.toRelationsFields);
      mapper.buildKuery(route.schema.response[200], this.toRelationsFields);
    },
    preload () {
      return mapper.preloadRuntimeResources(this.routeRuntime);
    },
    handleRequest (request, reply) {
      const scope = mapper.buildRuntimeScope(this.routeRuntime, request);
      mapper.infoEvent(1, () => [
        `${this.name}:`, scope.resourceId,
        "\n\trequest.query:", request.query,
      ]);
      scope.resource = mapper._engine.tryVrapper([scope.resourceId]);
      if (!scope.resource) {
        reply.code(404);
        reply.send(`No such ${route.config.resourceTypeName} route resource: ${scope.resourceId}`);
        return true;
      }
      const { fields } = request.query;
      return thenChainEagerly(scope.resource, [
        vResource => vResource.get(this.toRelationsFields, { scope, verbosity: 0 }),
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
