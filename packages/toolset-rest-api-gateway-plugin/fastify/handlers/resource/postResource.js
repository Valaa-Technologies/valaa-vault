// @flow

import type RestAPIServer, { Route } from "~/toolset-rest-api-gateway-plugin/fastify/RestAPIServer";

export default function createRouteHandler (server: RestAPIServer, route: Route) {
  return {
    category: "resource", method: "POST", fastifyRoute: route,
    requiredRules: [],
    builtinRules: {},
    prepare (/* fastify */) {
      this.scopeRules = server.prepareScopeRules(this);
      const toPatchTarget = ["§->"];
      server.buildKuery(route.config.resourceSchema, toPatchTarget);
      if (toPatchTarget.length > 1) this.toPatchTarget = toPatchTarget;
    },
    preload () {
      // const connection = await server.getDiscourse().acquirePartitionConnection(
      //    route.config.valos.subject, { newPartition: false }).getActiveConnection();
      // const vRoot = server.getEngine().getVrapper([connection.getPartitionRawId()]);
    },
    handleRequest (request, reply) {
      // const scope = server.buildRequestScope(request, this.scopeRules);
      server.infoEvent(1, () => [
        `${this.name}:`,
        "\n\trequest.query:", request.query,
        "\n\trequest.body:", request.body,
      ]);
      reply.code(501);
      reply.send("Not implemented");
      return false;
    },
  };
}
