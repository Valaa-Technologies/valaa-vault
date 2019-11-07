// @flow

import { _verifyResourceAuthorization } from "../_handlerOps";
import { _presolveResourceRouteRequest } from "../resource/_resourceHandlerOps";

export function _createToMapping (mapper, route, runtime) {
  const toMapping = ["§->"];
  mapper.appendSchemaSteps(runtime, route.config.resource.schema, { targetVAKON: toMapping });
  mapper.appendSchemaSteps(runtime, route.config.relation.schema, { targetVAKON: toMapping });
  toMapping.push(false, ["§filter", ["§==", ["§.", "target"], ["§$", "target"]]], 0);
  return toMapping;
}

export function _presolveMappingRouteRequest (mapper, route, runtime, valkOptions, toMapping) {
  if (_presolveResourceRouteRequest(mapper, route, runtime, valkOptions)) {
    return true;
  }
  const scope = valkOptions.scope;
  if (_verifyResourceAuthorization(mapper, { method: "GET", category: "mapping" }, scope,
      scope.target, "route target resource")) {
    return true;
  }
  scope.mapping = scope.resource.get(toMapping, valkOptions);
  return false;
}

/*
const { toMapping } = _createTargetedToMapping(mapper, this.runtime, route, ["!:target"]);
this.toMapping = toMapping;
const toRelations = mapper.appendSchemaSteps(this.runtime, route.config.relation.schema, [
  "§->",
  ...route.config.relation.name.split("/").slice(0, -1).map(name => ["§..", name]),
]);
toRelations.splice(-1);

export function _createTargetedToMapping (mapper, runtime, route, toTargetId) {
  const { toMappingFields, relationsStepIndex } =
      _createTargetedToMappingFields(mapper, runtime, route, toTargetId);
  toMappingFields.splice(-2, 1);
  return {
    toMapping: toMappingFields,
    relationsStepIndex,
  };
}
*/

/*
const { toMappingFields, relationsStepIndex } =
    _createTargetedToMappingFields(mapper, this.runtime, route, ["~$:targetId"]);
if (relationsStepIndex > 1) this.toRelationSource = toMappingFields.slice(0, relationsStepIndex);
this.toMapping = toMappingFields.slice(0, -2).concat(0);

export function _createTargetedToMappingFields (mapper, runtime, route, toTargetId) {
  const { toMappingsResults, relationsStepIndex } = _createToMappingsParts(mapper, runtime, route);
  toMappingsResults.splice(relationsStepIndex + 1, 0,
      ["~filter", ["~==", ["~->:target:rawId"], toTargetId]]);
  return {
    toMappingFields: [...toMappingsResults, 0],
    relationsStepIndex,
  };
}
*/

/*
const { toMappingsResults, relationsStepIndex } =
    _createToMappingsParts(mapper, this.runtime, route);

if (relationsStepIndex > 1) this.toRelationSource =
    toMappingsResults.slice(0, relationsStepIndex);
// const toMappingFields = _createToMappingFields(mapper, route);
// toMappingFields.splice(-1);

export function _createToMappingsParts (mapper, runtime, route) {
  const toMappingsResults = mapper.appendSchemaSteps(
      runtime, route.config.relation.schema, { expandProperties: true, targetVAKON: toRelations });
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
*/
