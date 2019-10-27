// @flow

import type MapperService, { Route } from "~/rest-api-spindle/fastify/MapperService";
import { dumpObject, thenChainEagerly } from "~/tools";

import { _verifyResourceAuthorization } from "./_resourceHandlerOps";

export default function createRouter (mapper: MapperService, route: Route) {
  return {
    requiredRules: ["routeRoot", "resource"],

    prepare (/* fastify */) {
      this.runtime = mapper.createRouteRuntime(this);
      const toPatchTarget = ["§->"];
      mapper.buildKuery(route.config.resourceSchema, toPatchTarget);
      if (toPatchTarget.length > 1) this.toPatchTarget = toPatchTarget.slice(0, -1);
    },

    preload () {
      return mapper.preloadRuntimeResources(this, this.runtime);
    },

    handler (request, reply) {
      const { scope } = mapper.buildRuntimeVALKOptions(this, this.runtime, request, reply);
      mapper.infoEvent(1, () => [
        `${this.name}:`, scope.resourceId,
        "\n\trequest.query:", request.query,
        "\n\trequest.body:", request.body,
      ]);
      if (_verifyResourceAuthorization(mapper, route, request, reply, scope)) return true;
      scope.resource = mapper._engine.tryVrapper([scope.resourceId]);
      if (!scope.resource) {
        reply.code(404);
        reply.send(`No such ${route.config.resourceTypeName} route resource: ${scope.resourceId}`);
        return true;
      }
      const wrap = new Error(this.name);
      const discourse = mapper.getDiscourse().acquireFabricator();
      return thenChainEagerly(discourse, [
        () => mapper.updateResource(scope.resource, request.body,
            { discourse, scope, route, toPatchTarget: this.toPatchTarget }),
        () => discourse.releaseFabricator(),
        eventResult => eventResult
            && eventResult.getPersistedEvent(),
        (/* persistedEvent */) => {
          const results = "UPDATED";
          reply.code(200);
          reply.send(results);
          mapper.infoEvent(2, () => [
            `${this.name}:`,
            "\n\tresults:", ...dumpObject(results),
          ]);
          return true;
        },
      ], (error) => {
        discourse.releaseFabricator({ abort: error });
        throw mapper.wrapErrorEvent(error, wrap,
          "\n\trequest.query:", ...dumpObject(request.query),
          "\n\trequest.body:", ...dumpObject(request.body),
          "\n\tscope.resource:", ...dumpObject(scope.resource),
          "\n\trouteRuntime:", ...dumpObject(this.runtime),
        );
      });
    },
  };
}
