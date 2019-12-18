// @flow

import type { PrefixRouter, Route } from "~/rest-api-spindle/MapperService";
import { dumpObject, thenChainEagerly } from "~/tools";

import { _createToMapping, _presolveMappingRouteRequest } from "./_mappingHandlerOps";

export default function createProjector (router: PrefixRouter, route: Route) {
  return {
    requiredRules: ["routeRoot", "mappingName", "doCreateMapping"],
    requiredRuntimeRules: ["resource", "target"],

    prepare () {
      this.runtime = router.createProjectorRuntime(this);
      _createToMapping(router, route, this.runtime);
    },

    preload () {
      return router.preloadRuntimeResources(this, this.runtime);
    },

    handler (request, reply) {
      router.infoEvent(1, () => [`${this.name}:`,
        "\n\trequest.query:", ...dumpObject(request.query),
        "\n\trequest.cookies:", ...dumpObject(Object.keys(request.cookies || {})),
        "\n\trequest.body:", ...dumpObject(request.body),
      ]);
      const valkOptions = router.buildRuntimeVALKOptions(this, this.runtime, request, reply);
      const scope = valkOptions.scope;
      if (_presolveMappingRouteRequest(router, route, this.runtime, valkOptions)) {
        return true;
      }
      router.infoEvent(2, () => [`${this.name}:`,
        "\n\tresource:", ...dumpObject(scope.resource),
        `\n\t${scope.mappingName}:`, ...dumpObject(scope.mapping),
        `\n\ttarget:`, ...dumpObject(scope.target),
      ]);

      const alreadyExisting = scope.mapping;
      if (!alreadyExisting && !scope.doCreateMapping) {
        reply.code(405);
        reply.send(`${this.name} is disabled: no doCreateMapping configured`);
        return true;
      }

      const wrap = new Error(this.name);
      valkOptions.route = route;
      valkOptions.discourse = router.getDiscourse().acquireFabricator();
      return thenChainEagerly(scope.resource, [
        vResource => scope.mapping || vResource.do(scope.doCreateMapping, valkOptions),
        vMapping => router.updateResource((scope.mapping = vMapping), request.body, valkOptions),
        () => valkOptions.discourse.releaseFabricator(),
        eventResult => eventResult && eventResult.getPersistedEvent(),
        (/* persistedEvent */) => {
          const results = {
            $V: {
              href: `${router.getResourceHRefPrefix(route.config.resource.schema)}${
                scope.resource.getRawId()}/${scope.mappingName}/${scope.target.getRawId()}`,
              rel: "self",
              target: { $V: {
                href: `${router.getResourceHRefPrefix(route.config.target.schema)}${
                  scope.target.getRawId()}`,
                rel: "self",
              } },
            }
          };
          reply.code(alreadyExisting ? 200 : 201);
          router.replySendJSON(reply, results);
          router.infoEvent(2, () => [
            `${this.name}:`,
            "\n\tresults:", ...dumpObject(results),
          ]);
          return true;
        },
      ], (error) => {
        valkOptions.discourse.releaseFabricator({ abort: error });
        throw router.wrapErrorEvent(error, wrap,
          "\n\trequest.query:", ...dumpObject(request.query),
          "\n\trequest.body:", ...dumpObject(request.body),
          "\n\tscope.resource:", ...dumpObject(scope.resource),
          "\n\tscope.source:", ...dumpObject(scope.source),
          "\n\tscope.mapping:", ...dumpObject(scope.mapping),
          "\n\tscope.target:", ...dumpObject(scope.target),
          "\n\tprojectorRuntime:", ...dumpObject(this.runtime),
        );
      });
    },
  };
}
