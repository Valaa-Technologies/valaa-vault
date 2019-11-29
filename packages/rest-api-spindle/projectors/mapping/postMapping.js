// @flow

import type { PrefixRouter, Route } from "~/rest-api-spindle/MapperService";
import { dumpObject, thenChainEagerly } from "~/tools";

import { _presolveResourceRouteRequest } from "../resource/_resourceHandlerOps";

export default function createProjector (router: PrefixRouter, route: Route) {
  return {
    requiredRules: ["routeRoot", "resource", "mappingName", "doCreateMappingAndTarget"],
    prepare () {
      this.runtime = router.createProjectorRuntime(this);

      this.toTargetPatchable = ["§->", false, "target"];
      router.appendSchemaSteps(this.runtime, route.config.target.schema,
          { targetVAKON: this.toTargetPatchable });
    },

    preload () {
      return router.preloadRuntimeResources(this, this.runtime);
    },

    handler (request, reply) {
      const valkOptions = router.buildRuntimeVALKOptions(this, this.runtime, request, reply);
      if (_presolveResourceRouteRequest(router, route, this.runtime, valkOptions)) {
        return true;
      }
      const scope = valkOptions.scope;
      if (!scope.doCreateMappingAndTarget) {
        reply.code(405);
        reply.send(`${this.name} is disabled: no 'doCreateMappingAndTarget' rule`);
        return true;
      }
      const targetName = ((request.body.$V || {}).target || {}).name;
      router.infoEvent(1, () => [
        `${this.name}:`, ...dumpObject(scope.resource),
        `\n\t${scope.mappingName} new target name:`, ...dumpObject(targetName),
        "\n\trequest.query:", request.query,
        "\n\trequest.body:", request.body,
      ]);
      if (typeof targetName !== "string") {
        reply.code(400);
        reply.send(`Required body.$V.target.name field is missing or is not a string`);
        return true;
      }

      const wrap = new Error(`mapping POST ${route.url}`);
      valkOptions.route = route;
      valkOptions.discourse = router.getDiscourse().acquireFabricator();
      return thenChainEagerly(scope.resource, [
        vResource => vResource.do(scope.doCreateMappingAndTarget, valkOptions),
        vMapping => router.updateResource((scope.mapping = vMapping), request.body, valkOptions),
        vMapping => router.updateResource(vMapping, request.body.$V.target,
              { ...valkOptions, toPatchTarget: this.toTargetPatchable }),
        () => valkOptions.discourse && valkOptions.discourse.releaseFabricator(),
        eventResult => eventResult && eventResult.getPersistedEvent(),
        (/* persistedEvent */) => {
          const targetId = scope.mapping.get("target").getRawId();
          const results = {
            $V: {
              href: `${router.getResourceHRefPrefix(route.config.resource.schema)
                }${scope.resource.getRawId()}/${scope.mappingName}/${targetId}`,
              rel: "self",
              target: { $V: {
                href: `${router.getResourceHRefPrefix(route.config.target.schema)}${targetId}`,
                rel: "self",
              } },
            }
          };
          reply.code(201);
          reply.send(JSON.stringify(results, null, 2));
          router.infoEvent(2, () => [
            `${this.name}:`,
            "\n\tresults:", ...dumpObject(results),
          ]);
          return true;
        },
      ], (error) => {
        if (valkOptions.discourse) valkOptions.discourse.releaseFabricator({ abort: error });
        throw router.wrapErrorEvent(error, wrap,
            "\n\trequest.query:", ...dumpObject(request.query),
            "\n\trequest.body:", ...dumpObject(request.body),
            "\n\tscope.resource:", ...dumpObject(scope.resource),
            "\n\tscope.source:", ...dumpObject(scope.source),
            "\n\tscope.target:", ...dumpObject(scope.target),
            "\n\tprojectorRuntime:", ...dumpObject(this.runtime),
        );
      });
    },
  };
}
