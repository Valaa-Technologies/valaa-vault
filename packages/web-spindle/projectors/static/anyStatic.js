// @flow

import type { PrefixRouter, Route } from "~/web-spindle/MapperService";
import { dumpObject } from "~/tools";

export default function createProjector (router: PrefixRouter, route: Route) {
  return {
    requiredRules: ["routeRoot"],
    runtimeRules: ["headers", "body"],

    prepare () {
      this.runtime = router.createProjectorRuntime(this, route);
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
        router.warnEvent(1, () =>
            [`RUNTIME RULE FAILURE in ${router._routeName(this.runtime.route)}.`]);
        return false;
      }
      router.infoEvent(2, () => [`${this.name}:`,
        "\n\theaders:", ...dumpObject(valkOptions.scope.headers),
        "\n\tbody:", ...dumpObject(valkOptions.scope.body),
      ]);
      for (const [headerName, headerValue] of Object.entries(valkOptions.scope.headers || {})) {
        reply.header(headerName, headerValue);
      }
      return router.fillReplyFromResponse(valkOptions.scope.body, this.runtime, valkOptions);
    },
  };
}
