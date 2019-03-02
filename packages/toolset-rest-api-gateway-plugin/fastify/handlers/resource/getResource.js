// @flow

import type RestAPIServer, { Route } from "~/toolset-rest-api-gateway-plugin/fastify/RestAPIServer";
import { dumpify, dumpObject } from "~/tools";

export default function createRouteHandler (server: RestAPIServer, route: Route) {
  return {
    category: "resource", method: "GET", fastifyRoute: route,
    requiredRules: ["resourceId"],
    builtinRules: {},
    prepare (/* fastify */) {
      this.scopeRules = server.prepareScopeRules(this);
      this.toResourceFields = ["§->"];
      server.buildKuery(route.schema.response[200], this.toResourceFields);
      this.hardcodedResources = route.config.valos.hardcodedResources;
    },
    preload () {
      // const connection = await server.getDiscourse().acquirePartitionConnection(
      //    route.config.valos.subject, { newPartition: false }).getActiveConnection();
      // const vRoot = server.getEngine().getVrapper([connection.getPartitionRawId()]);
    },
    handleRequest (request, reply) {
      const scope = server.buildRequestScope(request, this.scopeRules);
      server.infoEvent(1, () => [
        `${this.name}:`, scope.resourceId,
        "\n\trequest.query:", request.query,
        "\n\ttoResourceFields:", dumpify(this.toResourceFields),
      ]);
      scope.resource = server._engine.tryVrapper([scope.resourceId]);
      if (!scope.resource) {
        reply.code(404);
        reply.send(`No such ${route.config.resourceTypeName} route resource: ${scope.resourceId}`);
        return false;
      }
      let results = scope.resource.get(this.toResourceFields, { scope, verbosity: 0 })
          || this.hardcodedResources[scope.resourceId];
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
