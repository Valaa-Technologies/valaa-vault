// @flow

import { Vrapper } from "~/engine";

import { verifySessionAuthorization } from "~/toolset-rest-api-gateway-plugin/fastify/security";

export function _verifyResourceAuthorization (server, route, request, reply, scope) {
  if (!scope.subject || !(scope.subject instanceof Vrapper)) {
    throw new Error("Resource route subject missing or invalid");
  }
  return verifySessionAuthorization(server, route, request, reply, scope, scope.subject);
}
