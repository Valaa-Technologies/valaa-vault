// @flow

import { Vrapper } from "~/engine";

import type { PrefixRouter, Route } from "~/web-spindle/MapperService";
import { dumpObject, thenChainEagerly } from "~/tools";

import { _presolveRouteRequest } from "../_commonProjectorOps";

export default function createProjector (router: PrefixRouter, route: Route) {
  return {
    requiredRules: ["routeRoot"],
    runtimeRules: ["doCreateResource"],

    prepare () {
      this.runtime = router.createProjectorRuntime(this, route);
      router.createGetRelSelfHRef(this.runtime, "resourceHRef", route.config.resource.schema);
      this.toPatchTarget = router.appendSchemaSteps(this.runtime, route.config.resource.schema);
      if (this.toPatchTarget.length <= 1) this.toPatchTarget = undefined;
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
      const { doCreateResource } = this.runtime.resolvers;
      if (!doCreateResource) {
        reply.code(405);
        reply.send(`${this.name} is disabled: no runtime rule doCreateResource defined`);
        return true;
      }
      const valkOptions = router.buildRuntimeVALKOptions(this, this.runtime, request, reply);
      if (_presolveRouteRequest(router, this.runtime, valkOptions)) {
        return true;
      }
      const scope = valkOptions.scope;
      router.infoEvent(2, () => [`${this.name}:`,
        "\n\trequest.body:", ...dumpObject(request.body),
        "\n\tresolvers:", ...dumpObject(this.runtime.resolvers),
      ]);
      const wrap = new Error(`resource POST ${route.url}`);
      valkOptions.discourse = router.getDiscourse().acquireFabricator();
      return thenChainEagerly(valkOptions.discourse, [
        () => router.resolveToScope("resource", doCreateResource, scope.routeRoot, valkOptions),
          /*
          console.log("resource POST dump:", ...dumpObject(scope.doCreateResource),
              "\n\tserviceIndex:", ...dumpObject(scope.serviceIndex),
              "\n\ttoPatchTarget:", ...dumpObject(this.toPatchTarget));
          */
        vResource => {
          if (!vResource || !(vResource instanceof Vrapper)) {
            throw new Error(`${this.name} doCreateResource didn't return a resource value`);
          }
          if (request.body) {
            router.updateResource(vResource, request.body,
                  { ...valkOptions, route, toPatchTarget: this.toPatchTarget });
          }
        },
        () => valkOptions.discourse.releaseFabricator(),
        eventResult => eventResult
            && eventResult.getPersistedEvent(),
        (/* persistedEvent */) => {
          reply.code(201);
          return router.fillReplyFromResponse(scope.resource, this.runtime, valkOptions);
        },
      ], (error) => {
        if (valkOptions.discourse.isActiveFabricator()) {
          valkOptions.discourse.releaseFabricator({ abort: error });
        }
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
