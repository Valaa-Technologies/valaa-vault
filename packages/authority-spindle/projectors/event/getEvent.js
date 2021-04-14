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

      const eventIndex = parseInt(scope.eventIndex, 10);
      if (typeof eventIndex !== "number") {
        throw new Error(`Invalid non-integer eventIndex: "${scope.eventIndex}"`);
      }

      return thenChainEagerly(scope.connection.asSourceredConnection(), [
        connection => connection.narrateEventLog({
          eventIdBegin: eventIndex, eventIdEnd: eventIndex + 1, commands: false,
        }),
        (sections) => {
          for (const sectionEvents of Object.values(sections)) {
            for (const event of sectionEvents) {
              if ((((event || {}).aspects || {}).log || {}).index === eventIndex) {
                const deltaAspect = swapAspectRoot("delta", event, "event");
                reply.code(200);
                reply.send(JSON.stringify(deltaAspect));
                router.infoEvent(2, () => [
                  `${this.name}:`, 200,
                  "\n\tevent:", ...dumpObject(event),
                ]);
                return true;
              }
            }
          }
          reply.code(404);
          reply.send();
          router.infoEvent(2, () => [
            `${this.name}:`, 404,
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
