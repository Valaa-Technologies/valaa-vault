// @flow

import { Vrapper } from "~/engine";

import { verifySessionAuthorization } from "~/rest-api-spindle/fastify/security";

import { dumpObject } from "~/tools";

export function _presolveRouteRequest (mapper, route, runtime, valkOptions) {
  const scope = valkOptions.scope;
  if (_verifyResourceAuthorization(mapper, route, scope, scope.routeRoot, "route root")) {
    return true;
  }
  if (mapper.resolveRuntimeRules(this.runtime, valkOptions)) {
    mapper.warnEvent(1, () => [
      `RUNTIME RULE FAILURE ${this.name}.`,
      "\n\trequest.query:", ...dumpObject(scope.request.query),
      "\n\trequest.body:", ...dumpObject(scope.request.body),
    ]);
    return true;
  }
  return false;
}

export function _verifyResourceAuthorization (mapper, route, scope, resource, resourceName) {
  const isValid = (resource && (resource instanceof Vrapper));
  const failure = !isValid || verifySessionAuthorization(mapper, route, scope, resource);
  if (!failure) return failure;
  mapper.warnEvent(1, () => [
    `UNAUTHORIZED ACCESS of ${resourceName} in ${this.name}:`, ...dumpObject(scope.resource),
    "\n\trequest.query:", ...dumpObject((scope.request || {}).query),
    "\n\trequest.body:", ...dumpObject((scope.request || {}).body),
  ]);
  if (!isValid) throw new Error(`Resource ${resourceName} missing or invalid`);
  return true;
}
