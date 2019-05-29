// @flow

import type RestAPIServer, { Route } from "~/toolset-rest-api-gateway-plugin/fastify/RestAPIServer";
import { dumpObject, thenChainEagerly } from "~/tools";

import { _verifyResourceAuthorization } from "./_resourceHandlerOps";

export default function createRouteHandler (server: RestAPIServer, route: Route) {
  return {
    category: "resource", method: "GET", fastifyRoute: route,
    requiredRuntimeRules: ["resourceId"],
    builtinRules: {},
    prepare (/* fastify */) {
      this.scopeRules = server.prepareScopeRules(this);
      this.toResourceFields = ["§->"];
      server.buildKuery(route.schema.response[200], this.toResourceFields);
      this.hardcodedResources = route.config.valos.hardcodedResources;
    },
    async preload () {
      const connection = await server.getDiscourse().acquireConnection(
          route.config.valos.subject, { newPartition: false }).asActiveConnection();
      await server.preloadScopeRules(this.scopeRules);
      this.scopeRules.scopeBase = Object.freeze({
        subject: server.getEngine().getVrapper(
            [connection.getPartitionRawId(), { partition: String(connection.getPartitionURI()) }]),
        ...this.scopeRules.scopeBase,
      });
    },
    handleRequest (request, reply) {
      const scope = server.buildScope(request, this.scopeRules);
      server.infoEvent(2, () => [
        `${this.name}:`, scope.resourceId,
        "\n\trequest.query:", request.query,
      ]);
      if (_verifyResourceAuthorization(server, route, request, reply, scope)) return true;
      scope.resource = server._engine.tryVrapper([scope.resourceId]);
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
            && (results => server._pickResultFields(results, fields, route.schema.response[200])),
        results => {
          reply.code(200);
          reply.send(JSON.stringify(results, null, 2));
          server.infoEvent(2, () => [
            `${this.name}:`,
            "\n\tresults:", ...dumpObject(results),
          ]);
          return true;
        }
      ]);
    },
  };
}
