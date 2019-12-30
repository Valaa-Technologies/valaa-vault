// @flow

import type { PrefixRouter, Route } from "~/rest-api-spindle/MapperService";

import { _verifyResourceAuthorization } from "../_commonProjectorOps";
import { _presolveResourceRouteRequest } from "../resource/_resourceHandlerOps";

export function _createToMapping (router: PrefixRouter, route: Route, runtime) {
  const toMappingSource = runtime.toMappingSource = ["§->"];
  router.appendSchemaSteps(runtime, route.config.resource.schema, { targetVAKON: toMappingSource });
  const relationSchema = router.derefSchema(route.config.relation.schema);
  router.appendVPathSteps(runtime, relationSchema.valospace.reflection, toMappingSource);
  const relationsIndex = toMappingSource.findIndex(e => (e === "relations"));

  const toMapping = runtime.toMapping = ["§->"];
  toMapping.push(...toMappingSource.splice(relationsIndex));
  const filter = toMapping.find(e => e && (e[0] === "§filter"));
  filter[1] = ["§&&", filter[1], ["§==", ["§.", "target"], ["§$", "target"]]];
  if (toMapping[toMappingSource.length - 1][0] === "§map") toMapping.splice(-2, 2);
  toMapping.push(0);
}

export function _presolveMappingRouteRequest (
    router: PrefixRouter, runtime, valkOptions) {
  if (_presolveResourceRouteRequest(router, runtime, valkOptions)) {
    return true;
  }
  const scope = valkOptions.scope;
  if (scope.mappingName === undefined) throw new Error("mappingName missing from scope");
  if (scope.target && _verifyResourceAuthorization(router,
      { method: "GET", category: "mapping", url: runtime.route.url },
      scope, scope.target, "route target resource")) {
    return true;
  }
  scope.source = scope.resource.get(runtime.toMappingSource, Object.create(valkOptions));
  if (!scope.source) throw new Error("Could not resolve mapping source from resource");
  if (runtime.toMapping) {
    scope.mapping = scope.source.get(runtime.toMapping, Object.create(valkOptions));
  }
  return false;
}
