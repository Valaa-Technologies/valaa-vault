// @flow

import { Vrapper } from "~/engine";

import type MapperService, { Route } from "~/rest-api-spindle/fastify/MapperService";
import { dumpObject, thenChainEagerly } from "~/tools";

import { _verifyResourceAuthorization } from "./_resourceHandlerOps";

export default function createRouteHandler (mapper: MapperService, route: Route) {
  return {
    category: "resource", method: "POST", fastifyRoute: route,
    requiredRuntimeRules: [],
    builtinRules: {
      createResource: ["constant", route.config.createResource],
    },
    prepare (/* fastify */) {
      this.routeRuntime = mapper.createRouteRuntime(this);

      const toPatchTarget = ["§->"];
      mapper.buildKuery(route.config.resourceSchema, toPatchTarget);
      // if (toPatchTarget.length > 1) this.toPatchTarget = toPatchTarget;
    },
    async preload () {
      const viewFocus = mapper.getViewFocus();
      if (!viewFocus) throw new Error(`Can't locate viewFocus for route: ${this.name}`);
      await mapper.preloadRuntimeResources(this.routeRuntime);
      const connection = await mapper.getDiscourse().acquireConnection(
          route.config.valos.subject, { newPartition: false }).asActiveConnection();
      this.routeRuntime.scopeBase = Object.freeze({
        viewFocus,
        subject: mapper.getEngine().getVrapper(
            [connection.getPartitionRawId(), { partition: String(connection.getPartitionURI()) }]),
        ...this.routeRuntime.scopeBase,
      });
    },
    handleRequest (request, reply) {
      const scope = mapper.buildRuntimeScope(this.routeRuntime, request);
      mapper.infoEvent(1, () => [
        `${this.name}:`,
        "\n\trequest.query:", request.query,
        "\n\trequest.body:", request.body,
      ]);
      if (_verifyResourceAuthorization(mapper, route, request, reply, scope)) return true;
      if (!scope.createResource) {
        reply.code(405);
        reply.send(`${this.name} is disabled: no scope.createResource defined`);
        return false;
      }
      const wrap = new Error(`resource POST ${route.url}`);
      const discourse = mapper.getDiscourse().acquireFabricator();
      return thenChainEagerly(discourse, [
        () => {
          console.log("resource POST dump:", ...dumpObject(scope.createResource),
              "\n\tviewFocus:", ...dumpObject(scope.viewFocus),
              "\n\ttoPatchTarget:", ...dumpObject(this.toPatchTarget));
          return scope.viewFocus.do(scope.createResource, { discourse, scope });
        },
        vResource => {
          if (!vResource || !(vResource instanceof Vrapper)) {
            throw new Error(`${this.name} createResource didn't return a resource value`);
          }
          scope.resource = vResource;
          if (request.body) {
            mapper.updateResource(vResource, request.body,
                  { discourse, scope, route, toPatchTarget: this.toPatchTarget });
          }
        },
        () => discourse && discourse.releaseFabricator(),
        eventResult => eventResult
            && eventResult.getPersistedEvent(),
        (/* persistedEvent */) => {
          const resourceId = scope.resource.getRawId();
          const results = {
            $V: {
              href: `${mapper.getResourceHRefPrefix(route.config.resourceSchema)}${resourceId}`,
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
        if (discourse) discourse.releaseFabricator({ abort: error });
        throw mapper.wrapErrorEvent(error, wrap,
            "\n\trequest.query:", ...dumpObject(request.query),
            "\n\trequest.body:", ...dumpObject(request.body),
            "\n\tscope.resource:", ...dumpObject(scope.resource),
            "\n\tscope.source:", ...dumpObject(scope.source),
            "\n\tscope.target:", ...dumpObject(scope.target),
            "\n\trouteRuntime:", ...dumpObject(this.routeRuntime),
        );
      });
    },
  };
}
