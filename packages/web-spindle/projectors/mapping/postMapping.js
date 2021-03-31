// @flow

import { Vrapper } from "~/engine";

import type { PrefixRouter, Route } from "~/web-spindle/MapperService";
import { dumpObject, thenChainEagerly } from "~/tools";

import { _createToMapping, _presolveMappingRouteRequest } from "./_mappingHandlerOps";

export default function createProjector (router: PrefixRouter, route: Route) {
  return {
    requiredRules: ["routeRoot", "mappingName"],
    runtimeRules: ["doCreateMappingAndTarget"],
    valueAssertedRules: ["resource"],

    prepare () {
      this.runtime = router.createProjectorRuntime(this, route);
      _createToMapping(router, route, this.runtime);
      router.createGetRelSelfHRef(this.runtime, "resourceHRef", route.config.resource.schema);
      router.createGetRelSelfHRef(this.runtime, "targetHRef", route.config.target.schema);
      this.toMappingPatchTarget = ["§->", false, "target"];
      router.appendSchemaSteps(this.runtime, route.config.target.schema,
          { targetTrack: this.toMappingPatchTarget });
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
      const { doCreateMappingAndTarget } = this.runtime.ruleResolvers;
      if (!doCreateMappingAndTarget) {
        reply.code(405);
        reply.send(`${this.name} is disabled: no 'doCreateMappingAndTarget' rule`);
        return true;
      }
      const valkOptions = router.buildRuntimeVALKOptions(this, this.runtime, request, reply);
      if (!_presolveMappingRouteRequest(router, this.runtime, valkOptions)) {
        return true;
      }
      const scope = valkOptions.scope;
      const targetName = ((request.body.$V || {}).target || {}).name;
      router.infoEvent(2, () => [`${this.name}:`,
        "\n\trequest.body:", ...dumpObject(request.body),
        "\n\tresolvers:", ...dumpObject(this.runtime.ruleResolvers),
        "\n\tresource:", ...dumpObject(scope.resource),
        "\n\ttoMappingSource:", ...dumpObject(this.runtime.toMappingSource),
        "\n\tsource:", ...dumpObject(scope.source),
        `\n\ttarget:`, ...dumpObject(scope.target),
      ]);
      if (typeof targetName !== "string") {
        reply.code(400);
        reply.send(`Required body.$V.target.name field is missing or is not a string`);
        return true;
      }

      valkOptions.discourse = router.getDiscourse().acquireFabricator();
      return thenChainEagerly(scope.source, [
        vResource => router
            .resolveToScope("mapping", doCreateMappingAndTarget, vResource, valkOptions),
        vMapping => {
          if (!vMapping || !(vMapping instanceof Vrapper)) {
            throw new Error("doCreateMappingAndTarget didn't return anything");
          }
        },
        () => valkOptions.discourse && valkOptions.discourse.releaseFabricator(),
        eventResult => eventResult && eventResult.getRecordedEvent(),

        () => (valkOptions.discourse = router.getDiscourse().acquireFabricator()),
        () => router.updateResource(scope.mapping, request.body,
              { ...valkOptions, patchValosFields: false }),
        () => router.updateResource(scope.mapping, request.body.$V.target,
              { ...valkOptions, toPatchTarget: this.toMappingPatchTarget }),
        () => valkOptions.discourse && valkOptions.discourse.releaseFabricator(),
        eventResult => eventResult && eventResult.getRecordedEvent(),
        (/* persistedEvent */) => {
          reply.code(201);
          return router.fillReplyFromResponse(
              [scope.resource, scope.mappingName, scope.mapping.step("target")],
              this.runtime, valkOptions);
        },
      ], (error) => {
        if (valkOptions.discourse && valkOptions.discourse.isActiveFabricator()) {
          valkOptions.discourse.releaseFabricator({ abort: error });
        }
        throw router.wrapErrorEvent(error, 1,
            error.chainContextName(`mapping POST ${route.url}`),
            "\n\trequest.query:", ...dumpObject(request.query),
            "\n\trequest.body:", ...dumpObject(request.body),
            "\n\tscope.resource:", ...dumpObject(scope.resource),
            "\n\tscope.mapping:", ...dumpObject(scope.mapping),
            "\n\tthis.toMappingPatchTarget:", ...dumpObject(scope.toMappingPatchTarget),
            "\n\tprojectorRuntime:", ...dumpObject(this.runtime),
        );
      });
    },
  };
}
