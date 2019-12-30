// @flow

import { Vrapper } from "~/engine";

import { verifySessionAuthorization } from "~/rest-api-spindle/tools/security";

import { dumpObject } from "~/tools";

export function _presolveRouteRequest (router, runtime, valkOptions, route = runtime.route) {
  const scope = valkOptions.scope;
  if ((valkOptions.scope.request !== null) // if there is no request, this is a preload request
      && _verifyResourceAuthorization(router, route, scope, scope.routeRoot, "route root")) {
    return true;
  }
  if (router.presolveRulesToScope(runtime, valkOptions)) {
    router.warnEvent(1, () => [
      `RUNTIME RULE FAILURE ${router._routeName(runtime.route)}.`,
      ...(route === runtime.route ? [] : ["\n\tsub-route:", router._routeName(route)]),
      "\n\trequest.query:", ...dumpObject(scope.request.query),
      "\n\trequest.cookies:", ...dumpObject(Object.keys(scope.request.cookies || {})),
      "\n\trequest.body:", ...dumpObject(scope.request.body),
    ]);
    return true;
  }
  return false;
}

export function _verifyResourceAuthorization (router, route, scope, resource, resourceName) {
  if (!resource || (Array.isArray(resource) ? !resource.length : !(resource instanceof Vrapper))) {
    throw new Error(`Resource '${resourceName}' missing or invalid`);
  }
  return verifySessionAuthorization(router, route, scope, resource, resourceName);
}
