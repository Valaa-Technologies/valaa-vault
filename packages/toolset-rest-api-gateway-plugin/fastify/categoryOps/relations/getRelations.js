// @flow

import type RestAPIServer, { Route } from "~/toolset-rest-api-gateway-plugin/fastify/RestAPIServer";
import { dumpify } from "~/tools";

export function createHandler (server: RestAPIServer, route: Route) {
  // const connection = await server.getDiscourse().acquirePartitionConnection(
  //    route.config.valos.subject, { newConnection: false }).getActiveConnection();
  // const vRoot = server.getEngine().getVrapper([connection.getPartitionRawId()]);
  const kuery = ["§->",
      ...route.config.relationName.split("/").slice(0, -1).map(name => ["§..", name])];
  server._buildKuery(route.schema.response[200], kuery);

  return (request, reply) => {
    const sourceId = request.params[route.config.sourceIdRouteParam];
    server.logEvent(1, () => [
      `relations GET ${route.url}:`, sourceId,
      "\n\trequest.query:", request.query,
      "\n\tkuery:", dumpify(kuery),
    ]);
    const vSource = server._engine.tryVrapper([sourceId]);
    if (!vSource) {
      reply.code(404);
      reply.send(`No such ${route.config.sourceTypeName}: ${sourceId}`);
    }
    let result = vSource.get(kuery, { verbosity: 0 });
    const { fields } = request.query;
    if (fields) {
      result = server._pickResultsFields(result, fields)[0];
    }
    reply.send(JSON.stringify(result, null, 2));
    reply.code(200);
  };
}
