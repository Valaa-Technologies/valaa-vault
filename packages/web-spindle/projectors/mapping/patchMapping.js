// @flow

import type { PrefixRouter, Route } from "~/web-spindle/MapperService";
import { dumpObject, thenChainEagerly } from "~/tools";

import { _createToMapping, _presolveMappingRouteRequest } from "./_mappingHandlerOps";

export default function createProjector (router: PrefixRouter, route: Route) {
  return {
    requiredRules: ["routeRoot", "mappingName"],
    runtimeRules: ["doCreateMapping"],
    valueAssertedRules: ["resource", "target"],

    prepare () {
      this.runtime = router.createProjectorRuntime(this, route);
      _createToMapping(router, route, this.runtime);
      router.createGetRelSelfHRef(this.runtime, "resourceHRef", route.config.resource.schema);
      router.createGetRelSelfHRef(this.runtime, "targetHRef", route.config.target.schema);
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
      const scope = valkOptions.scope;
      if (_presolveMappingRouteRequest(router, this.runtime, valkOptions)) {
        return true;
      }
      router.infoEvent(2, () => [`${this.name}:`,
        "\n\trequest.body:", ...dumpObject(request.body),
        "\n\tresolvers:", ...dumpObject(this.runtime.ruleResolvers),
        "\n\tresource:", ...dumpObject(scope.resource),
        `\n\t${scope.mappingName}:`, ...dumpObject(scope.mapping),
        `\n\ttarget:`, ...dumpObject(scope.target),
      ]);
      const { doCreateMapping } = this.runtime.ruleResolvers;

      const isNewlyCreated = !scope.mapping;
      if (isNewlyCreated && !doCreateMapping) {
        reply.code(405);
        reply.send(`${this.name} is disabled: no doCreateMapping configured`);
        return true;
      }

      const wrap = new Error(this.name);
      valkOptions.discourse = router.getDiscourse().acquireFabricator();
      return thenChainEagerly(scope.resource, [
        vResource => scope.mapping
            || router.resolveToScope("mapping", doCreateMapping, vResource, valkOptions),
        vMapping => router.updateResource(vMapping, request.body, valkOptions),
        () => valkOptions.discourse.releaseFabricator(),
        eventResult => eventResult && eventResult.getPersistedEvent(),
        (/* persistedEvent */) => {
          if (isNewlyCreated) reply.code(201);
          return router.fillReplyFromResponse(
              [scope.resource, scope.mappingName, scope.mapping.get("target")],
              this.runtime, valkOptions);
      },
      ], (error) => {
        if (valkOptions.discourse.isActiveFabricator()) {
          valkOptions.discourse.releaseFabricator({ abort: error });
        }
        throw router.wrapErrorEvent(error, 1, wrap,
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
