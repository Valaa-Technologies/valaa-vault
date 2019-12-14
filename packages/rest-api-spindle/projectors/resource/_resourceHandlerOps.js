// @flow

import type { PrefixRouter, Route } from "~/rest-api-spindle/MapperService";

import { _verifyResourceAuthorization, _presolveRouteRequest } from "../_commonProjectorOps";

export function _presolveResourceRouteRequest (
    router: PrefixRouter, route: Route, runtime, valkOptions) {
  if (_presolveRouteRequest(
      router, { method: "GET", category: route.category, url: route.url }, runtime, valkOptions)) {
    return true;
  }
  const scope = valkOptions.scope;
  if (!scope.resource) {
    scope.reply.code(404);
    scope.reply.send(`No such ${route.config.resource.name} route resource`);
    return true;
  }

  if (_verifyResourceAuthorization(router, route, scope, scope.resource, "route resource")) {
    return true;
  }
  return false;
}
