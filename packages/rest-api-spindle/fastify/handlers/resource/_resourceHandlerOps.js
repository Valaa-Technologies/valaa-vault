// @flow

import { _verifyResourceAuthorization, _presolveRouteRequest } from "../_handlerOps";

export function _presolveResourceRouteRequest (mapper, route, runtime, valkOptions) {
  if (_presolveRouteRequest(
      mapper, { method: "GET", category: route.category }, runtime, valkOptions)) {
    return true;
  }
  const scope = valkOptions.scope;
  if (!scope.resource) {
    scope.reply.code(404);
    scope.reply.send(`No such ${route.config.resource.name} route resource`);
    return true;
  }

  if (_verifyResourceAuthorization(mapper, route, scope, scope.resource, "route resource")) {
    return true;
  }
  return false;
}
