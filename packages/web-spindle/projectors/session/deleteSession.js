
import type { PrefixRouter, Route } from "~/web-spindle/MapperService";
import { burlaesgDecode, hs256JWTDecode } from "~/web-spindle/tools/security";

import { dumpObject } from "~/tools/wrapError";

export default function createProjector (router: PrefixRouter, route: Route) {
  return {
    requiredRules: ["routeRoot"],
    valueAssertedRules: ["clientRedirectPath", "clientCookie", "sessionCookie"],

    prepare () {
      this.runtime = router.createProjectorRuntime(this, route);

      const routeIdentity = this.runtime.identity;
      if (!routeIdentity) {
        throw new Error("Cannot prepare session route DELETE: service identity not configured");
      }
      this.runtime.scopePreparations.identity = Object.freeze({
        clientSecret: routeIdentity.clientSecret,
        clientURI: routeIdentity.clientURI,
        clientCookieName: routeIdentity.getClientCookieName(),
        sessionCookieName: routeIdentity.getSessionCookieName(),
      });
    },

    preload () {
      return router.preloadRuntimeResources(this, this.runtime);
    },

    handler (request, reply) {
      router.infoEvent(1, () => [`${this.name}:`,
        "\n\trequest.params:", ...dumpObject(request.params),
        "\n\trequest.query:", ...dumpObject(request.query),
        "\n\trequest.cookies:", ...dumpObject(Object.keys(request.cookies || {})),
      ]);
      const valkOptions = router.buildRuntimeVALKOptions(this, this.runtime, request, reply);
      if (router.presolveRulesToScope(this.runtime, valkOptions)) {
        router.warnEvent(1, () => [`RUNTIME RULE FAILURE ${router._routeName(route)}.`]);
        return true;
      }
      const scope = valkOptions.scope;
      router.infoEvent(2, () => [`${this.name}:`,
        "\n\tclientCookie:", ...dumpObject(scope.clientCookie),
        "\n\tsessionCookie:", ...dumpObject(scope.sessionCookie),
      ]);
      if (!scope.clientCookie || !scope.sessionCookie) {
        reply.code(404);
        reply.send("No session found");
        return true;
      }
      const { identityChronicle } = burlaesgDecode(
          scope.sessionCookie, scope.identity.clientSecret.slice(0, 30)).payload;

      const { iss, sub } =
          hs256JWTDecode(scope.clientCookie, scope.identity.clientSecret).payload;
      if (iss !== scope.identity.clientURI || !identityChronicle || (identityChronicle !== sub)) {
        reply.code(400);
        reply.send("Bad Request");
        return true;
      }
      reply.setCookie(scope.identity.clientCookieName, "",
          { httpOnly: false, secure: true, maxAge: 0, path: scope.clientRedirectPath });
      reply.setCookie(scope.identity.sessionCookieName, "",
          { httpOnly: true, secure: true, maxAge: 0, path: scope.clientRedirectPath });
      reply.code(303);
      reply.redirect(scope.clientRedirectPath);
      return true;
    },
  };
}
