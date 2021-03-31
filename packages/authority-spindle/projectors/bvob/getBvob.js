// @flow

import valosheath from "@valos/gateway-api/valosheath";

import type { PrefixRouter, Route } from "~/web-spindle/MapperService";
import { _prepareChronicleRequest } from "../_common";

const { dumpObject, thenChainEagerly } = valosheath.require("@valos/tools");

export default function createProjector (router: PrefixRouter, route: Route) {
  return {
    requiredRules: ["routeRoot", "authorityURI"],
    valueAssertedRules: ["chroniclePlot", "contentHash"],

    prepare () {
      this.runtime = router.createProjectorRuntime(this, route);
    },

    preload () {
      return router.preloadRuntimeResources(this, this.runtime);
    },

    handler (request, reply) {
      const { valkOptions, scope, discourse, chronicleURI } =
          _prepareChronicleRequest(router, this, request, reply);
      if (!valkOptions) return false;

      router.infoEvent(2, () => [`${this.name}:`,
        "\n\trequest.body:", ...dumpObject(request.body),
        "\n\tresolvers:", ...dumpObject(this.runtime.ruleResolvers),
        "\n\tchroniclePlot:", ...dumpObject(scope.chroniclePlot),
        "\n\tcontentHash:", ...dumpObject(scope.contentHash),
      ]);
      // const {} = this.runtime.ruleResolvers;

      return thenChainEagerly(scope.connection.asSourceredConnection(), [
        connection => {
          // Add or validate body event index to equal scope.eventIndex
          return connection.narrateEventLog({
            eventIdBegin: scope.eventIndex,
            eventIdEnd: scope.eventIndex,
            commands: false,
          });
        },
        // () => valkOptions.discourse.releaseFabricator(),
        (sections) => {
          // Flatten sections and pick correct event
          reply.code(200);
          reply.send(sections);
          router.infoEvent(2, () => [
            `${this.name}:`,
            "\n\tsections:", ...dumpObject(sections),
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
