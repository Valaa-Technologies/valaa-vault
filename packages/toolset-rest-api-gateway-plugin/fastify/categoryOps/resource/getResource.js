// @flow

import type RestAPIServer, { Route } from "~/toolset-rest-api-gateway-plugin/fastify/RestAPIServer";

export function createHandler (server: RestAPIServer, route: Route) {
  // const connection = await server.getDiscourse().acquirePartitionConnection(
  //    route.config.valos.subject, { newConnection: false }).getActiveConnection();
  // const vRoot = server.getEngine().getVrapper([connection.getPartitionRawId()]);

  const kuery = ["§->"];
  server._buildKuery(route.schema.response[200], kuery);
  const hardcodedResources = route.config.valos.hardcodedResources;

  return (request, reply) => {
    const resourceId = request.params[route.config.idRouteParam];
    server.logEvent(1, () => [
      `resource GET ${route.url}:`, resourceId,
      "\n\trequest.query:", request.query,
    ]);
    const vResource = server._engine.tryVrapper([resourceId]);
    let result = (vResource && vResource.get(kuery, { verbosity: 0 }))
        || hardcodedResources[resourceId];
    if (result === undefined) {
      reply.code(404);
      reply.send(`Resource not found: <${resourceId}>`);
      return;
    }
    const { fields } = request.query;
    if (fields) {
      result = server._pickResultsFields([result], fields)[0];
    }
    reply.send(JSON.stringify(result, null, 2));
  };
}
