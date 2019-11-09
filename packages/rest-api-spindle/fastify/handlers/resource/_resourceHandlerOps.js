// @flow

import type { PrefixRouter, Route } from "~/rest-api-spindle/fastify/MapperService";

import { _verifyResourceAuthorization, _presolveRouteRequest } from "../_handlerOps";

export function _presolveResourceRouteRequest (
    router: PrefixRouter, route: Route, runtime, valkOptions) {
  if (_presolveRouteRequest(
      router, { method: "GET", category: route.category }, runtime, valkOptions)) {
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
