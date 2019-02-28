// @flow

import type RestAPIServer, { Route } from "~/toolset-rest-api-gateway-plugin/fastify/RestAPIServer";
import { thenChainEagerly } from "~/tools";

export function createHandler (server: RestAPIServer, route: Route) {
  // const connection = await server.getDiscourse().acquirePartitionConnection(
  //    route.config.valos.subject, { newConnection: false }).getActiveConnection();
  // const vRoot = server.getEngine().getVrapper([connection.getPartitionRawId()]);
  return (request, reply) => {
    const resourceId = request.params[route.config.idRouteParam];
    server.logEvent(1, () => [
      `resource PATCH ${route.url}:`, resourceId,
      "\n\trequest.query:", request.query,
      "\n\trequest.body:", request.body,
    ]);
    const vResource = server._engine.tryVrapper([resourceId]);
    if (!vResource) {
      reply.code(404);
      reply.send(`No such ${route.config.resourceTypeName}: ${resourceId}`);
      return;
    }
    const transaction = server.getDiscourse().acquireTransaction();
    thenChainEagerly(transaction, [
      () => server._patchResource(vResource, request, transaction, route),
      () => transaction.releaseTransaction(),
      eventResult => eventResult && eventResult.getPersistedEvent(),
      () => {
        reply.code(200);
        reply.send("UPDATED");
      },
    ], (error) => {
      transaction.abortTransaction();
      reply.code(500);
      reply.send(error.message);
    });
  };
}
