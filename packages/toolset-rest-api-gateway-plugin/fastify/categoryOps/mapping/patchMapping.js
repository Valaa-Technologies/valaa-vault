// @flow

import type RestAPIServer, { Route } from "~/toolset-rest-api-gateway-plugin/fastify/RestAPIServer";
import { dumpify, thenChainEagerly } from "~/tools";

export async function preload (server: RestAPIServer, route: Route) {
  await server.getDiscourse()
      .acquirePartitionConnection(route.config.prototypeRef[1].partition)
      .getActiveConnection();
  route.vPrototype = server.getEngine().getVrapper(route.config.prototypeRef);
}

export function createHandler (server: RestAPIServer, route: Route) {
  // const connection = await server.getDiscourse().acquirePartitionConnection(
  //    route.config.valos.subject, { newConnection: false }).getActiveConnection();
  // const vRoot = server.getEngine().getVrapper([connection.getPartitionRawId()]);
  const kuery = ["§->",
      ...route.config.mappingName.split("/").slice(0, -1).map(name => ["§..", name])];
  server._buildKuery(route.config.RelationTypeSchema, kuery);
  const sliceRelationsPosition = kuery.indexOf("relations");
  const midkuery = sliceRelationsPosition > 1 ? kuery.slice(0, sliceRelationsPosition) : undefined;
  kuery.splice(-1);

  return (request, reply) => {
    const sourceId = request.params[route.config.sourceIdRouteParam];
    const targetId = request.params[route.config.targetIdRouteParam];
    server.logEvent(1, () => [
      `mapping PATCH ${route.url}:`, sourceId, route.config.mappingName, targetId,
      "\n\trequest.query:", request.query,
      "\n\trequest.body:", request.body,
      "\n\tkuery:", dumpify(kuery, { indent: 2 }),
      "\n\tmidkuery:", dumpify(midkuery, { indent: 2 }),
    ]);
    const vSource = server._engine.tryVrapper([sourceId]);
    if (!vSource) {
      reply.code(404);
      reply.send(`No such ${route.config.sourceTypeName} source: ${sourceId}`);
      return;
    }
    let result = vSource.get(kuery, { verbosity: 0 });
    result = result.filter(entry => (entry.get(["§->", "target", "rawId"]) === targetId))[0];
    let vTarget;
    if (result === undefined) {
      vTarget = server._engine.tryVrapper([targetId]);
      if (!vTarget) {
        reply.code(404);
        reply.send(`No such ${route.config.targetTypeName} target: ${targetId}`);
        return;
      }
    }
    const transaction = server.getDiscourse().acquireTransaction();
    thenChainEagerly(transaction, [
      () => {
        if (result) return result;
        const source = !midkuery ? vSource : vSource.get(midkuery, { transaction });
        return route.vPrototype.instantiate({ source, target: vTarget }, { transaction });
      },
      vMapping => server._patchResource(vMapping, request, transaction, route),
      () => transaction.releaseTransaction(),
      eventResult => eventResult && eventResult.getPersistedEvent(),
      () => {
        reply.code(vTarget ? 201 : 200);
        reply.send(vTarget ? "CREATED" : "UPDATED");
      },
    ], (error) => {
      transaction.abortTransaction();
      reply.code(500);
      reply.send(error.message);
    });
  };
}
