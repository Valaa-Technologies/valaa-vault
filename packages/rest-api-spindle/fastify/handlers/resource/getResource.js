// @flow

import type MapperService, { Route } from "~/rest-api-spindle/fastify/MapperService";
import { dumpObject, thenChainEagerly } from "~/tools";

import { _verifyResourceAuthorization } from "./_resourceHandlerOps";

export default function createRouteHandler (mapper: MapperService, route: Route) {
  return {
    category: "resource", method: "GET", fastifyRoute: route,
    requiredRuntimeRules: ["resourceId"],
    builtinRules: {},
    prepare (/* fastify */) {
      this.routeRuntime = mapper.createRouteRuntime(this);
      this.toResourceFields = ["§->"];
      mapper.buildKuery(route.schema.response[200], this.toResourceFields);
      this.hardcodedResources = route.config.valos.hardcodedResources;
    },
    async preload () {
      const connection = await mapper.getDiscourse().acquireConnection(
          route.config.valos.subject, { newPartition: false }).asActiveConnection();
        subject: server.getEngine().getVrapper(
      await mapper.preloadRuntimeResources(this.routeRuntime);
      this.routeRuntime.scopeBase = Object.freeze({
            [connection.getPartitionRawId(), { partition: String(connection.getPartitionURI()) }]),
        ...this.routeRuntime.scopeBase,
      });
    },
    handleRequest (request, reply) {
      const scope = mapper.buildRuntimeScope(this.routeRuntime, request);
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
