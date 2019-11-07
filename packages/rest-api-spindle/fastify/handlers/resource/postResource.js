// @flow

import { Vrapper } from "~/engine";

import type MapperService, { Route } from "~/rest-api-spindle/fastify/MapperService";
import { dumpObject, thenChainEagerly } from "~/tools";

import { _presolveRouteRequest } from "../_handlerOps";

export default function createRouter (mapper: MapperService, route: Route) {
  return {
    requiredRules: ["routeRoot", "doCreateResource"],

    prepare (/* fastify */) {
      this.runtime = mapper.createRouteRuntime(this);
      this.toPatchTarget = mapper.appendSchemaSteps(this.runtime, route.config.resource.schema);
      if (this.toPatchTarget.length <= 1) this.toPatchTarget = undefined;
    },

    preload () {
      return mapper.preloadRuntimeResources(this, this.runtime);
    },

    handler (request, reply) {
      const valkOptions = mapper.buildRuntimeVALKOptions(this, this.runtime, request, reply);
      const scope = valkOptions.scope;
      if (_presolveRouteRequest(mapper, route, this.runtime, valkOptions)) {
        return true;
      }
      mapper.infoEvent(1, () => [
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
      valkOptions.discourse = mapper.getDiscourse().acquireFabricator();
      return thenChainEagerly(valkOptions.discourse, [
        () => {
          console.log("resource POST dump:", ...dumpObject(scope.doCreateResource),
              "\n\tserviceIndex:", ...dumpObject(scope.serviceIndex),
              "\n\ttoPatchTarget:", ...dumpObject(this.toPatchTarget));
          return scope.routeRoot.do(scope.doCreateResource, valkOptions);
          // return scope.serviceIndex.do(scope.doCreateResource, valkOptions);
        },
        vResource => {
          if (!vResource || !(vResource instanceof Vrapper)) {
            throw new Error(`${this.name} doCreateResource didn't return a resource value`);
          }
          scope.resource = vResource;
          if (request.body) {
            mapper.updateResource(vResource, request.body,
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
              href: `${mapper.getResourceHRefPrefix(route.config.resource.schema)}${resourceId}`,
              rel: "self",
            },
          };
          reply.code(201);
          reply.send(JSON.stringify(results, null, 2));
          mapper.infoEvent(2, () => [
            `${this.name}:`,
            "\n\tresults:", ...dumpObject(results),
          ]);
          return true;
        },
      ], (error) => {
        valkOptions.discourse.releaseFabricator({ abort: error });
        throw mapper.wrapErrorEvent(error, wrap,
            "\n\trequest.query:", ...dumpObject(request.query),
            "\n\trequest.body:", ...dumpObject(request.body),
            "\n\tscope.resource:", ...dumpObject(scope.resource),
            "\n\tscope.source:", ...dumpObject(scope.source),
            "\n\tscope.target:", ...dumpObject(scope.target),
            "\n\trouteRuntime:", ...dumpObject(this.runtime),
        );
      });
    },
  };
}
