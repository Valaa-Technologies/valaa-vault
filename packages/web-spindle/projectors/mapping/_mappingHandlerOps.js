// @flow

import type { PrefixRouter, Route } from "~/web-spindle/MapperService";

import { _verifyResourceAuthorization } from "../_commonProjectorOps";
import { _presolveResourceRouteRequest } from "../resource/_resourceHandlerOps";

import { dumpObject } from "~/tools";

export function _createToMapping (router: PrefixRouter, route: Route, runtime) {
  const toMappingSource = runtime.toMappingSource = ["§->"];
  const toMapping = runtime.toMapping = ["§->"];
  try {
    router.appendSchemaSteps(
        runtime, route.config.resource.schema, { targetTrack: toMappingSource });
    const relationSchema = router.derefSchema(route.config.relation.schema);
    router.appendVPathSteps(runtime, relationSchema.valospace.reflection, toMappingSource);
    const relationsIndex = toMappingSource.findIndex(e => (e === "relations"));

    toMapping.push(...toMappingSource.splice(relationsIndex));
    const filter = toMapping.find(e => e && (e[0] === "§filter"));
    if (!filter) throw new Error("mapping is missing filter clause");
    filter[1] = ["§&&", filter[1], ["§==", ["§.", "target"], ["§$", "target"]]];
    if (toMapping[toMappingSource.length - 1][0] === "§map") toMapping.splice(-2, 2);
    toMapping.push(0);
  } catch (error) {
    throw router.wrapErrorEvent(error, 1,
        new Error(`During _createToMapping(${router._routeName(route)}`),
        "\n\ttoMappingSource:", ...dumpObject(toMappingSource),
        "\n\ttoMapping:", ...dumpObject(toMapping),
    );
  }
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
