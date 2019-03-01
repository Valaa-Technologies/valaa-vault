// @flow

import type RestAPIServer, { Route } from "~/toolset-rest-api-gateway-plugin/fastify/RestAPIServer";

export function createHandler (server: RestAPIServer, route: Route) {
  // const connection = await server.getDiscourse().acquirePartitionConnection(
  //    route.config.valos.subject, { newConnection: false }).getActiveConnection();
  // const vRoot = server.getEngine().getVrapper([connection.getPartitionRawId()]);
  const kuery = ["§->",
      ...route.config.mappingName.split("/").slice(0, -1).map(name => ["§..", name])];
  server._buildKuery(route.config.RelationTypeSchema, kuery);

  return (request, reply) => {
    const scope = {};
    Object.entries(route.config.routeParams)
        .map(([target, paramName]) => (scope[target] = request.params[paramName]));
    server.logEvent(1, () => [
      `mapping GET ${route.url}:`, scope.sourceId, route.config.mappingName, scope.targetId,
      "\n\trequest.query:", request.query,
    ]);
    const vSource = server._engine.tryVrapper([scope.sourceId]);
    if (!vSource) {
      reply.code(404);
      reply.send(`No such ${route.config.sourceTypeName}: ${scope.sourceId}`);
      return;
    }
    let result = vSource.get(kuery, { verbosity: 0 });
    result = result.filter(entry => (entry.$V || {}).target
        && (entry.$V.target.getRawId() === scope.targetId))[0];
    if (result === undefined) {
      reply.code(404);
      reply.send(`No mapping '${route.config.mappingName}' found between ${scope.sourceId} and ${
        scope.targetId}`);
      return;
    }
    const { fields } = request.query;
    if (fields) {
      result = server._pickResultsFields([result], fields)[0];
    }
    reply.send(JSON.stringify(result, null, 2));
  };
}
