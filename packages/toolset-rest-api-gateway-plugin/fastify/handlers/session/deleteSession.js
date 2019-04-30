
import type RestAPIServer, { Route } from "~/toolset-rest-api-gateway-plugin/fastify/RestAPIServer";

export default function createRouteHandler (server: RestAPIServer, route: Route) {
  return {
    category: "session", method: "DELETE", fastifyRoute: route,
    requiredRuntimeRules: [],
    builtinRules: {},
    prepare (/* fastify */) {
      this.scopeRules = server.prepareScopeRules(this);
    },
    preload () {
      // const connection = await server.getDiscourse().acquirePartitionConnection(
      //    route.config.valos.subject, { newPartition: false }).getActiveConnection();
      // const vRoot = server.getEngine().getVrapper([connection.getPartitionRawId()]);
    },
    handleRequest (request, reply) {
      // const scope = server.buildScope(request, this.scopeRules);
      server.infoEvent(1, () => [
        "\n\trequest.query:", request.query,
        "\n\trequest.cookies:", request.cookies,
      ]);
      reply.code(501);
      reply.send(`Not implemented yet`);
      return false;
    },
  };
}
