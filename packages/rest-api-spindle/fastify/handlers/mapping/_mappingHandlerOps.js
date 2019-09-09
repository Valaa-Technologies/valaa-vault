// @flow

import { Vrapper } from "~/engine";

import { verifySessionAuthorization } from "~/rest-api-spindle/fastify/security";

import { _addToRelationsSourceSteps } from "../_handlerOps";

export function _resolveMappingResource (server, route, request, reply, scope) {
  scope.resource = server._engine.tryVrapper([scope.resourceId]);
  if (!scope.resource || !(scope.resource instanceof Vrapper)) {
    reply.code(404);
    reply.send(`No such ${route.config.resourceTypeName} route resource: ${scope.resourceId}`);
    return true;
  }
  return verifySessionAuthorization(server, route, request, reply, scope, scope.resource);
}

export function _createTargetedToMapping (server, route, toTargetId) {
  const { toMappingFields, relationsStepIndex } =
      _createTargetedToMappingFields(server, route, toTargetId);
  toMappingFields.splice(-2, 1);
  return {
    toMapping: toMappingFields,
    relationsStepIndex,
  };
}

export function _createTargetedToMappingFields (server, route, toTargetId) {
  const { toMappingsResults, relationsStepIndex } = _createToMappingsParts(server, route);
  toMappingsResults.splice(relationsStepIndex + 1, 0,
      ["~filter", ["~==", ["~->:target:rawId"], toTargetId]]);
  return {
    toMappingFields: [...toMappingsResults, 0],
    relationsStepIndex,
  };
}

export function _createToMappingsParts (server, route) {
  const toMappingsResults = ["§->"];
  _addToRelationsSourceSteps(server, route.config.resourceSchema, route.config.mappingName,
      toMappingsResults);
  server.buildKuery(route.config.relationSchema, toMappingsResults);
  const relationsStepIndex = toMappingsResults.indexOf("relations");
  if (!(relationsStepIndex >= 0)) {
    throw new Error(`Could not find 'relations' step from kuery built from relationSchema while${
        ""} preparing main mapping kuery`);
  }
  return {
    toMappingsResults,
    relationsStepIndex,
  };
}
