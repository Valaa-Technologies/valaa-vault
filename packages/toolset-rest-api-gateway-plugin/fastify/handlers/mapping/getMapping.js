// @flow

import type RestAPIServer, { Route } from "~/toolset-rest-api-gateway-plugin/fastify/RestAPIServer";
import { dumpify, dumpObject } from "~/tools";

import { _createTargetedToMappingFields } from "./_mappingHandlerOps";

export default function createRouteHandler (server: RestAPIServer, route: Route) {
  return {
    category: "mapping", method: "GET", fastifyRoute: route,
    requiredRules: ["resourceId", "mappingName", "targetId"],
    builtinRules: {
      mappingName: ["constant", route.config.mappingName],
    },
    prepare (/* fastify */) {
      this.scopeRules = server.prepareScopeRules(this);
      this.toMappingFields = _createTargetedToMappingFields(server, route, ["~$:targetId"])
          .toMappingFields;
    },
    preload () {
      // const connection = await server.getDiscourse().acquirePartitionConnection(
      //    route.config.valos.subject, { newPartition: false }).getActiveConnection();
      // const vRoot = server.getEngine().getVrapper([connection.getPartitionRawId()]);
    },
    handleRequest (request, reply) {
      const scope = server.buildRequestScope(request, this.scopeRules);
      server.infoEvent(1, () => [
        `${this.name}:`, scope.resourceId, scope.mappingName, scope.targetId,
        "\n\trequest.query:", request.query,
        "\n\ttoMappingFields:", dumpify(this.toMappingFields),
      ]);
      scope.resource = server._engine.tryVrapper([scope.resourceId]);
      if (!scope.resource) {
        reply.code(404);
        reply.send(`No such ${route.config.resourceTypeName} route resource: ${scope.resourceId}`);
        return false;
      }
      let results = scope.resource.get(this.toMappingFields, { scope, verbosity: 0 });
      if (!results) {
        reply.code(404);
        reply.send(`No mapping '${route.config.mappingName}' found from route resource ${
          scope.resourceId} to ${scope.targetId}`);
        return false;
      }
      const { fields } = request.query;
      if (fields) {
        results = server._pickResultFields(results, fields);
      }
      reply.code(200);
      reply.send(JSON.stringify(results, null, 2));
      server.infoEvent(2, () => [
        `${this.name}:`,
        "\n\tresults:", ...dumpObject(results),
      ]);
      return true;
    },
  };
}
