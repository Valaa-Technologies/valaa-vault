// @flow

import { Vrapper } from "~/engine";

import { verifySessionAuthorization } from "~/rest-api-spindle/fastify/security";

export function _verifyResourceAuthorization (mapper, route, request, reply, scope) {
  if (!scope.routeRoot || !(scope.routeRoot instanceof Vrapper)) {
    throw new Error("Resource route routeRoot missing or invalid");
  }
  return verifySessionAuthorization(mapper, route, request, reply, scope, scope.routeRoot);
}
}
