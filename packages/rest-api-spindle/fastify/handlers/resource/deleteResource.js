// @flow

import type MapperService from "~/rest-api-spindle/fastify/MapperService";
// import { dumpObject, thenChainEagerly } from "~/tools";
// import { _verifyResourceAuthorization } from "./_resourceHandlerOps";

export default function createRouter (mapper: MapperService /* , route: Route */) {
  return {
    requiredRules: ["routeRoot", "resource"],

    prepare (/* fastify */) {
      this.runtime = mapper.createRouteRuntime(this);
    },

    preload () {
      return mapper.preloadRuntimeResources(this, this.runtime);
    },

    handler (request, reply) {
      const { scope } = mapper.buildRuntimeVALKOptions(this, this.runtime, request, reply);
      mapper.infoEvent(1, () => [
        `${this.name}:`, scope.resourceId,
        "\n\trequest.query:", request.query,
      ]);
      reply.code(501);
      reply.send("Unimplemented");
      return true;
      // Root resource deletion not implemented yet, due to lack of
      // mechanisms for declaring what sub-resources should be
      // destroyed as well.
      /*
      if (_verifyResourceAuthorization(mapper, route, request, reply, scope)) return true;
      scope.resource = mapper._engine.tryVrapper([scope.resourceId]);
      if (!scope.resource) {
        reply.code(404);
        reply.send(`No such ${route.config.resourceTypeName} route resource: ${scope.resourceId}`);
        return false;
      }
      const wrap = new Error(this.name);
      return thenChainEagerly(null, [
        () => scope.resource.destroy(),
        eventResult => eventResult.getPersistedEvent(),
        () => {
          const results = "DESTROYED";
          reply.code(200);
          reply.send(results);
          mapper.infoEvent(2, () => [
            `${this.name}:`,
            "\n\tresults:", ...dumpObject(results),
          ]);
          return true;
        },
      ], (error) => {
        throw mapper.wrapErrorEvent(error, wrap,
          "\n\trequest.query:", ...dumpObject(request.query),
          "\n\tscope.resource:", ...dumpObject(scope.resource),
          "\n\trouteRuntime:", ...dumpObject(this.runtime),
        );
      });
      */
    },
  };
}
