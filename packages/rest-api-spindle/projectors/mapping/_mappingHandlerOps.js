// @flow

import type { PrefixRouter, Route } from "~/rest-api-spindle/MapperService";

import { _verifyResourceAuthorization } from "../_commonProjectorOps";
import { _presolveResourceRouteRequest } from "../resource/_resourceHandlerOps";

export function _createToMapping (router: PrefixRouter, route: Route, runtime) {
  const toMapping = ["§->"];
  router.appendSchemaSteps(runtime, route.config.resource.schema, { targetVAKON: toMapping });
  router.appendSchemaSteps(runtime, route.config.relation.schema, { targetVAKON: toMapping });
  toMapping.push(false, ["§filter", ["§==", ["§.", "target"], ["§$", "target"]]], 0);
  return toMapping;
}

export function _presolveMappingRouteRequest (
    router: PrefixRouter, route: Route, runtime, valkOptions, toMapping) {
  if (_presolveResourceRouteRequest(router, route, runtime, valkOptions)) {
    return true;
  }
  const scope = valkOptions.scope;
  if (_verifyResourceAuthorization(router, { method: "GET", category: "mapping" }, scope,
      scope.target, "route target resource")) {
    return true;
  }
  scope.mapping = scope.resource.get(toMapping, valkOptions);
  return false;
}

/*
const { toMapping } = _createTargetedToMapping(router, this.runtime, route, ["!:target"]);
this.toMapping = toMapping;
const toRelations = router.appendSchemaSteps(this.runtime, route.config.relation.schema, [
  "§->",
  ...route.config.relation.name.split("/").slice(0, -1).map(name => ["§..", name]),
]);
toRelations.splice(-1);

export function _createTargetedToMapping (router: PrefixRouter, runtime, route, toTargetId) {
  const { toMappingFields, relationsStepIndex } =
      _createTargetedToMappingFields(router, runtime, route, toTargetId);
  toMappingFields.splice(-2, 1);
  return {
    toMapping: toMappingFields,
    relationsStepIndex,
  };
}
*/

/*
const { toMappingFields, relationsStepIndex } =
    _createTargetedToMappingFields(router, this.runtime, route, ["~$:targetId"]);
if (relationsStepIndex > 1) this.toRelationSource = toMappingFields.slice(0, relationsStepIndex);
this.toMapping = toMappingFields.slice(0, -2).concat(0);

export function _createTargetedToMappingFields (router: PrefixRouter, runtime, route, toTargetId) {
  const { toMappingsResults, relationsStepIndex } = _createToMappingsParts(router, runtime, route);
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
    _createToMappingsParts(router, this.runtime, route);

if (relationsStepIndex > 1) this.toRelationSource =
    toMappingsResults.slice(0, relationsStepIndex);
// const toMappingFields = _createToMappingFields(router, route);
// toMappingFields.splice(-1);

export function _createToMappingsParts (router: PrefixRouter, runtime, route) {
  const toMappingsResults = router.appendSchemaSteps(
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
