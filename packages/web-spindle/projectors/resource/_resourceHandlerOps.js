// @flow

import type { PrefixRouter, Route } from "~/web-spindle/MapperService";

import { _verifyResourceAuthorization, _presolveRouteRequest } from "../_commonProjectorOps";

export function _presolveResourceRouteRequest (router: PrefixRouter, runtime, valkOptions,
    route: Route = runtime.route) {
  if (!_presolveRouteRequest(router, runtime, valkOptions,
      { method: "GET", projector: route.projector, url: route.url })) {
    return false;
  }
  const scope = valkOptions.scope;
  if (!scope.resource) {
    scope.reply.code(404);
    scope.reply.send(`No such ${runtime.route.config.resource.name} route resource`);
    return false;
  }

  if (!_verifyResourceAuthorization(router, route, scope, [scope.resource, scope.routeRoot],
      "route resource")) {
    return false;
  }
  return true;
}
