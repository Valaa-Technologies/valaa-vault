// @flow

import type RestAPIServer, { Route } from "~/rest-api-spindle/fastify/RestAPIServer";
import { dumpObject, thenChainEagerly } from "~/tools";

import { _verifyResourceAuthorization } from "./_resourceHandlerOps";

export default function createRouteHandler (server: RestAPIServer, route: Route) {
  return {
    category: "resource", method: "PATCH", fastifyRoute: route,
    requiredRuntimeRules: ["resourceId"],
    builtinRules: {},
    prepare (/* fastify */) {
      this.scopeRules = server.prepareScopeRules(this);

      const toPatchTarget = ["§->"];
      server.buildKuery(route.config.resourceSchema, toPatchTarget);
      if (toPatchTarget.length > 1) this.toPatchTarget = toPatchTarget.slice(0, -1);
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
      server.infoEvent(1, () => [
        `${this.name}:`, scope.resourceId,
        "\n\trequest.query:", request.query,
        "\n\trequest.body:", request.body,
      ]);
      if (_verifyResourceAuthorization(server, route, request, reply, scope)) return true;
      scope.resource = server._engine.tryVrapper([scope.resourceId]);
      if (!scope.resource) {
        reply.code(404);
        reply.send(`No such ${route.config.resourceTypeName} route resource: ${scope.resourceId}`);
        return true;
      }
      const wrap = new Error(this.name);
      const discourse = server.getDiscourse().acquireFabricator();
      return thenChainEagerly(discourse, [
        () => server.patchResource(scope.resource, request.body,
            { discourse, scope, route, toPatchTarget: this.toPatchTarget }),
        () => discourse.releaseFabricator(),
        eventResult => eventResult
            && eventResult.getPersistedEvent(),
        (/* persistedEvent */) => {
          const results = "UPDATED";
          reply.code(200);
          reply.send(results);
          server.infoEvent(2, () => [
            `${this.name}:`,
            "\n\tresults:", ...dumpObject(results),
          ]);
          return true;
        },
      ], (error) => {
        discourse.releaseFabricator({ abort: error });
        throw server.wrapErrorEvent(error, wrap,
          "\n\trequest.query:", ...dumpObject(request.query),
          "\n\trequest.body:", ...dumpObject(request.body),
          "\n\tscope.resource:", ...dumpObject(scope.resource),
          "\n\tscopeRules:", ...dumpObject(this.scopeRules),
        );
      });
    },
  };
}
