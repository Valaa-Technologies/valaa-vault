// @flow

import { Vrapper } from "~/engine";

import type RestAPIServer, { Route } from "~/toolset-rest-api-gateway-plugin/fastify/RestAPIServer";
import { dumpObject, thenChainEagerly } from "~/tools";

import { _verifyResourceAuthorization } from "./_resourceHandlerOps";

export default function createRouteHandler (server: RestAPIServer, route: Route) {
  return {
    category: "resource", method: "POST", fastifyRoute: route,
    requiredRuntimeRules: [],
    builtinRules: {
      createResource: ["constant", route.config.createResource],
    },
    prepare (/* fastify */) {
      this.scopeRules = server.prepareScopeRules(this);

      const toPatchTarget = ["§->"];
      server.buildKuery(route.config.resourceSchema, toPatchTarget);
      // if (toPatchTarget.length > 1) this.toPatchTarget = toPatchTarget;
    },
    async preload () {
      this.vPreloads = server.preloadVAKONRefResources(route.config.scope);
      server.preloadVAKONRefResources(route.config.createResource, this.vPreloads);
      await Promise.all(this.vPreloads.map(vPreload => vPreload.activate()));
      const scriptRoot = this.vPreloads[0] || server.getViewFocus();
      if (!scriptRoot) throw new Error(`Can't locate scriptRoot for route: ${this.name}`);
      this.scopeRules.scopeBase = Object.freeze({
        ...this.scopeRules.scopeBase,
        scriptRoot,
      });
    },
    handleRequest (request, reply) {
      const scope = server.buildScope(request, this.scopeRules);
      server.infoEvent(1, () => [
        `${this.name}:`,
        "\n\trequest.query:", request.query,
        "\n\trequest.body:", request.body,
      ]);
      if (!_verifyResourceAuthorization(server, route, request, reply, scope)) return false;
      if (!scope.createResource) {
        reply.code(405);
        reply.send(`${this.name} is disabled: no scope.createResource defined`);
        return false;
      }
      const wrap = new Error(`resource POST ${route.url}`);
      const discourse = server.getDiscourse().acquireTransaction();
      return thenChainEagerly(discourse, [
        () => {
          // Replace with createMapping call proper. Now using old idiom
          // and explicit instantiate.
          console.log("resource POST:", scope.createResource,
              "\n\tscriptRoot:", scope.scriptRoot && scope.scriptRoot.debugId(),
              "\n\ttoPatchTarget:", ...dumpObject(this.toPatchTarget));
          return scope.scriptRoot.do(scope.createResource, { discourse, scope });
        },
        vResource => {
          if (!vResource || !(vResource instanceof Vrapper)) {
            throw new Error(`${this.name} createResource didn't return a resource value`);
          }
          scope.resource = vResource;
          if (request.body) {
            server.patchResource(vResource, request.body,
                  { discourse, scope, route, toPatchTarget: this.toPatchTarget });
          }
        },
        () => discourse && discourse.releaseTransaction(),
        eventResult => eventResult
            && eventResult.getPersistedEvent(),
        (/* persistedEvent */) => {
          const resourceId = scope.resource.getRawId();
          const results = {
            $V: {
              href: `${server.getResourceHRefPrefix(route.config.resourceSchema)}${resourceId}`,
              rel: "self",
            },
          };
          reply.code(201);
          reply.send(JSON.stringify(results, null, 2));
          server.infoEvent(2, () => [
            `${this.name}:`,
            "\n\tresults:", ...dumpObject(results),
          ]);
          return true;
        },
      ], (error) => {
        if (discourse) discourse.releaseTransaction({ abort: error });
        throw server.wrapErrorEvent(error, wrap,
            "\n\trequest.query:", ...dumpObject(request.query),
            "\n\trequest.body:", ...dumpObject(request.body),
            "\n\tscope.resource:", ...dumpObject(scope.resource),
            "\n\tscope.source:", ...dumpObject(scope.source),
            "\n\tscope.target:", ...dumpObject(scope.target),
            "\n\tscopeRules:", ...dumpObject(this.scopeRules),
        );
      });
    },
  };
}
