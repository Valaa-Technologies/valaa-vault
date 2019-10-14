// @flow

import { Vrapper } from "~/engine";

import { verifySessionAuthorization } from "~/rest-api-spindle/fastify/security";

export function _verifyResourceAuthorization (mapper, route, request, reply, scope) {
  if (!scope.subject || !(scope.subject instanceof Vrapper)) {
    throw new Error("Resource route subject missing or invalid");
  }
  return verifySessionAuthorization(server, route, request, reply, scope, scope.subject);
}
