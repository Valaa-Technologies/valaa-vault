// @flow

import { Vrapper } from "~/engine";

import { verifySessionAuthorization } from "~/rest-api-spindle/fastify/security";

import { _buildToRelationsSource } from "../_handlerOps";

export function _resolveMappingResource (mapper, route, request, reply, scope) {
  scope.resource = mapper.getEngine().tryVrapper([scope.resourceId]);
  if (!scope.resource || !(scope.resource instanceof Vrapper)) {
    reply.code(404);
    reply.send(`No such ${route.config.resource.name} route resource: ${scope.resourceId}`);
    return true;
  }
  return verifySessionAuthorization(mapper, route, request, reply, scope, scope.resource);
}

export function _createTargetedToMapping (mapper, route, toTargetId) {
  const { toMappingFields, relationsStepIndex } =
      _createTargetedToMappingFields(mapper, route, toTargetId);
  toMappingFields.splice(-2, 1);
  return {
    toMapping: toMappingFields,
    relationsStepIndex,
  };
}

export function _createTargetedToMappingFields (mapper, route, toTargetId) {
  const { toMappingsResults, relationsStepIndex } = _createToMappingsParts(mapper, route);
  toMappingsResults.splice(relationsStepIndex + 1, 0,
      ["~filter", ["~==", ["~->:target:rawId"], toTargetId]]);
  return {
    toMappingFields: [...toMappingsResults, 0],
    relationsStepIndex,
  };
}

export function _createToMappingsParts (mapper, route) {
  const toMappingsResults = mapper.buildSchemaKuery(route.config.relation.schema,
      _buildToRelationsSource(mapper, route.config.resource.schema, route.config.mapping.name));
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
