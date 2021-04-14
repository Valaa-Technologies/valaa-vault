// @flow

import valosheath from "@valos/gateway-api/valosheath";

import type { PrefixRouter, Route } from "~/web-spindle/MapperService";
import { _prepareChronicleRequest } from "../_common";

const { dumpObject, thenChainEagerly } = valosheath.require("@valos/tools");

export default function createProjector (router: PrefixRouter, route: Route) {
  return {
    requiredRules: ["routeRoot", "authorityURI"],
    runtimeRules: ["headers"],
    valueAssertedRules: ["chroniclePlot", "contentHash"],

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
        "\n\tcontentHash:", ...dumpObject(scope.contentHash),
      ]);
      // const {} = this.runtime.ruleResolvers;

      return thenChainEagerly(scope.connection.asSourceredConnection(), [
        () => request.file().then(data => data.toBuffer()),
        async buffer => scope.connection
            .prepareBvob(buffer, { contentHash: scope.contentHash }).persistProcess,
        // () => valkOptions.discourse.releaseFabricator(),
        (persistedContentHash) => {
          if (scope.contentHash !== persistedContentHash) {
            console.log("foo:", scope.contentHash, persistedContentHash);
            reply.code(400);
            reply.send("content hash mismatch");
          } else {
            reply.code(201);
            reply.send();
          }
          router.infoEvent(2, () => [
            `${this.name}:`, reply.statusCode,
            "\n\tpersistedContentHash:", ...dumpObject(persistedContentHash),
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
