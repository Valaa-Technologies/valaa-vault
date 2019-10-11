
import type RestAPIService, { Route } from "~/rest-api-spindle/fastify/RestAPIService";
import { burlaesgDecode, hs256JWTDecode } from "~/rest-api-spindle/fastify/security";

export default function createRouteHandler (server: RestAPIService, route: Route) {
  return {
    category: "session", method: "DELETE", fastifyRoute: route,
    requiredRuntimeRules: [
      "clientRedirectPath", "clientCookie", "sessionCookie",
    ],
    builtinRules: {},
    prepare (/* fastify */) {
      this._identity = server.getIdentity();
      if (!this._identity) {
        throw new Error("Cannot prepare session route DELETE: identity not configured");
      }
      this.builtinRules.clientCookie = ["cookies", this._identity.getClientCookieName()];
      this.builtinRules.sessionCookie = ["cookies", this._identity.getSessionCookieName()];
      this.routeRuntime = server.prepareRuntime(this);
    },
    preload () {
      return server.preloadRuntime(this.routeRuntime);
    },
    handleRequest (request, reply) {
      const scope = server.buildScope(request, this.routeRuntime);
      server.infoEvent(1, () => [
        "\n\trequest.query:", request.query,
        "\n\trequest.cookies:", request.cookies,
      ]);
      if (!scope.clientCookie || !scope.sessionCookie) {
        reply.code(404);
        reply.send("No session found");
        return true;
      }
      const { identityPartition } =
          burlaesgDecode(scope.sessionCookie, this._identity.clientSecret).payload;
      const { iss, sub } =
          hs256JWTDecode(scope.clientCookie, this._identity.clientSecret).payload;
      if (iss !== this._identity.clientURI || !identityPartition || (identityPartition !== sub)) {
        reply.code(400);
        reply.send("Bad Request");
        return true;
      }
      reply.setCookie(this._identity.getClientCookieName(),
          "", { httpOnly: false, secure: true, maxAge: 0, path: scope.clientRedirectPath });
      reply.setCookie(this._identity.getSessionCookieName(),
          "", { httpOnly: true, secure: true, maxAge: 0, path: scope.clientRedirectPath });
      reply.code(303);
      reply.redirect(scope.clientRedirectPath);
      return true;
    },
  };
}
