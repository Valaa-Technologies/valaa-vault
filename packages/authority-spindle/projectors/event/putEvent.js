// @flow

import valosheath from "@valos/gateway-api/valosheath";

import { swapAspectRoot } from "~/sourcerer/tools/EventAspects";
import type { PrefixRouter, Route } from "~/web-spindle/MapperService";

import { _prepareChronicleRequest } from "../_common";

const { dumpObject, thenChainEagerly } = valosheath.require("@valos/tools");

export default function createProjector (router: PrefixRouter, route: Route) {
  return {
    requiredRules: ["routeRoot", "authorityURI"],
    runtimeRules: ["headers"],
    valueAssertedRules: ["chroniclePlot", "eventIndex"],

    prepare () {
      this.runtime = router.createProjectorRuntime(this, route);
    },

    preload () {
      return router.preloadRuntimeResources(this, this.runtime);
    },

    handler (request, reply) {
      const { valkOptions, scope /* , discourse, chronicleURI */ } =
          _prepareChronicleRequest(router, this, request, reply);
      if (!valkOptions) return false;

      router.infoEvent(2, () => [`${this.name}:`,
        "\n\trequest.body:", ...dumpObject(request.body),
        "\n\tresolvers:", ...dumpObject(this.runtime.ruleResolvers),
        "\n\tchroniclePlot:", ...dumpObject(scope.chroniclePlot),
        "\n\teventIndex:", ...dumpObject(scope.eventIndex),
      ]);
      // const {} = this.runtime.ruleResolvers;

      return thenChainEagerly(scope.connection.asSourceredConnection(), [
        connection => {
          const deltaAspect = request.body;
          const eventAspect = swapAspectRoot("event", deltaAspect, "delta");

          // Add or validate body event index to equal scope.eventIndex
          return connection.proclaimEvents([eventAspect]).eventResults[0];
        },
        // () => valkOptions.discourse.releaseFabricator(),
        eventResult => eventResult && eventResult.getTruthEvent(),
        (truthEvent) => {
          reply.code(201);
          reply.send(JSON.stringify({ log: truthEvent.aspects.log }));
          router.infoEvent(2, () => [
            `${this.name}:`,
            "\n\tresults:", ...dumpObject(JSON.stringify(truthEvent, null, 2)),
          ]);
          return true;
        },
      ], (error) => {
        throw router.wrapErrorEvent(error, 1, error.chainContextName(this.name),
          "\n\trequest.query:", ...dumpObject(request.query),
          "\n\trequest.body:", ...dumpObject(request.body),
          "\n\tscope.resource:", ...dumpObject(scope.resource),
          "\n\tprojectorRuntime:", ...dumpObject(this.runtime),
        );
      });
    },
  };
}
