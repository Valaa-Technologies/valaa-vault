// @flow

import { verifySessionAuthorization } from "~/toolset-rest-api-gateway-plugin/fastify/security";

export function _verifyResourceAuthorization (server, route, request, reply, scope) {
  return verifySessionAuthorization(server, route, request, reply, scope, scope.subject);
}
