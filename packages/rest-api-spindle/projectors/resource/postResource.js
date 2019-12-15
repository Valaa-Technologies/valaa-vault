// @flow

import { Vrapper } from "~/engine";

import type { PrefixRouter, Route } from "~/rest-api-spindle/MapperService";
import { dumpObject, thenChainEagerly } from "~/tools";

import { _presolveRouteRequest } from "../_commonProjectorOps";

export default function createProjector (router: PrefixRouter, route: Route) {
  return {
    requiredRules: ["routeRoot", "doCreateResource"],

    prepare () {
      this.runtime = router.createProjectorRuntime(this);
      this.toPatchTarget = router.appendSchemaSteps(this.runtime, route.config.resource.schema);
      if (this.toPatchTarget.length <= 1) this.toPatchTarget = undefined;
    },

    preload () {
      return router.preloadRuntimeResources(this, this.runtime);
    },

    handler (request, reply) {
      const valkOptions = router.buildRuntimeVALKOptions(this, this.runtime, request, reply);
      const scope = valkOptions.scope;
      if (_presolveRouteRequest(router, route, this.runtime, valkOptions)) {
        return true;
      }
      router.infoEvent(1, () => [
        `${this.name}:`,
        "\n\trequest.query:", request.query,
        "\n\trequest.body:", request.body,
      ]);
      if (!scope.doCreateResource) {
        reply.code(405);
        reply.send(`${this.name} is disabled: no scope.doCreateResource defined`);
        return false;
      }
      const wrap = new Error(`resource POST ${route.url}`);
      valkOptions.discourse = router.getDiscourse().acquireFabricator();
      return thenChainEagerly(valkOptions.discourse, [
        () =>
          /*
          console.log("resource POST dump:", ...dumpObject(scope.doCreateResource),
              "\n\tserviceIndex:", ...dumpObject(scope.serviceIndex),
              "\n\ttoPatchTarget:", ...dumpObject(this.toPatchTarget));
          */
          scope.routeRoot.do(scope.doCreateResource, valkOptions),
          // return scope.serviceIndex.do(scope.doCreateResource, valkOptions);
        vResource => {
          if (!vResource || !(vResource instanceof Vrapper)) {
            throw new Error(`${this.name} doCreateResource didn't return a resource value`);
          }
          scope.resource = vResource;
          if (request.body) {
            router.updateResource(vResource, request.body,
                  { ...valkOptions, route, toPatchTarget: this.toPatchTarget });
          }
        },
        () => valkOptions.discourse.releaseFabricator(),
        eventResult => eventResult
            && eventResult.getPersistedEvent(),
        (/* persistedEvent */) => {
          const resourceId = scope.resource.getRawId();
          const results = {
            $V: {
              href: `${router.getResourceHRefPrefix(route.config.resource.schema)}${resourceId}`,
              rel: "self",
            },
          };
          reply.code(201);
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
            "\n\tscope.target:", ...dumpObject(scope.target),
            "\n\tprojectorRuntime:", ...dumpObject(this.runtime),
        );
      });
    },
  };
}
