// @flow

import valosheath from "~/gateway-api/valosheath";
import { swapAspectRoot } from "~/sourcerer/tools/EventAspects";

import type { PrefixRouter, Route } from "~/web-spindle/MapperService";
import { _prepareChronicleRequest } from "../_common";

const { dumpObject, thenChainEagerly } = valosheath.require("@valos/tools");

export default function createProjector (router: PrefixRouter, route: Route) {
  return {
    requiredRules: ["routeRoot", "authorityURI"],
    runtimeRules: ["headers", "startIndex", "endIndex"],
    valueAssertedRules: ["chroniclePlot"],

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
        "\n\tindexRange:", ...dumpObject(scope.indexRange),
      ]);
      // const {} = this.runtime.ruleResolvers;

      // TODO(iridian, 2021-04): Should validate startIndex against first body event

      return thenChainEagerly(scope.connection.asSourceredConnection(), [
        connection => {
          const commands = request.body.map(deltaAspect =>
              swapAspectRoot("event", deltaAspect, "delta"));
          return connection.proclaimEvents(commands);
        },
        // () => valkOptions.discourse.releaseFabricator(),
        eventResults => Promise.all((eventResults || []).map(result => result.getTruthEvent())),
        (truthEvents) => {
          reply.code(201);
          reply.send(JSON.stringify(truthEvents
              .map(truthEvent => ({ log: truthEvent.aspects.log }))));
          router.infoEvent(2, () => [
            `${this.name}:`,
            "\n\tresults:", ...dumpObject(truthEvents),
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
