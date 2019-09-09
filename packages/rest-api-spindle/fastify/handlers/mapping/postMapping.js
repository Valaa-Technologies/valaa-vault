// @flow

import type RestAPIServer, { Route } from "~/rest-api-spindle/fastify/RestAPIServer";
import { dumpObject, thenChainEagerly } from "~/tools";

import { _createToMappingsParts, _resolveMappingResource } from "./_mappingHandlerOps";

export default function createRouteHandler (server: RestAPIServer, route: Route) {
  return {
    category: "mapping", method: "POST", fastifyRoute: route,
    requiredRuntimeRules: ["resourceId", "mappingName"],
    builtinRules: {
      mappingName: ["constant", route.config.mappingName],
      createResourceAndMapping: ["constant", route.config.createResourceAndMapping],
    },
    prepare (/* fastify */) {
      this.scopeRules = server.prepareScopeRules(this);
      const { toMappingsResults, relationsStepIndex } = _createToMappingsParts(server, route);

      if (relationsStepIndex > 1) this.toSource = toMappingsResults.slice(0, relationsStepIndex);
      // const toMappingFields = _createToMappingFields(server, route);
      // toMappingFields.splice(-1);

      this.toPatchTarget = ["§->", false, "target"];
      server.buildKuery(route.config.targetSchema, this.toPatchTarget);
      this.toPatchTarget.splice(-1);
    },
    async preload () {
      const viewFocus = server.getViewFocus();
      if (!viewFocus) throw new Error(`Can't locate viewFocus for route: ${this.name}`);
      await server.preloadScopeRules(this.scopeRules);
      this.scopeRules.scopeBase = Object.freeze({
        viewFocus,
        ...this.scopeRules.scopeBase,
      });
    },
    handleRequest (request, reply) {
      const scope = server.buildScope(request, this.scopeRules);
      server.infoEvent(1, () => [
        `${this.name}:`, scope.resourceId, scope.mappingName,
        "\n\trequest.query:", request.query,
        "\n\trequest.body:", request.body,
      ]);
      if (!scope.createResourceAndMapping) {
        reply.code(405);
        reply.send(`${this.name} is disabled: no configuration for resource and mapping creation`);
        return true;
      }
      const targetName = ((request.body.$V || {}).target || {}).name;

      if (typeof targetName !== "string") {
        reply.code(400);
        reply.send(`Required body.$V.target.name string field is missing or malformed`);
        return true;
      }

      if (_resolveMappingResource(server, route, request, reply, scope)) return true;

      const wrap = new Error(`mapping POST ${route.url}`);
      const discourse = undefined; // server.getDiscourse().acquireFabricator();
      return thenChainEagerly(discourse, [
        () => {
          scope.source = !this.toSource
              ? scope.resource
              : scope.resource.get(this.toSource, { discourse, scope });
          console.log("mapping POST dump:", ...dumpObject(scope.createResourceAndMapping),
              "\n\tviewFocus:", ...dumpObject(scope.viewFocus),
              "\n\tsource:", ...dumpObject(scope.source),
              "\n\tname:", targetName);
          return scope.viewFocus.do(scope.createResourceAndMapping, { discourse, scope });
        },
        vMapping => {
          scope.mapping = server.patchResource(vMapping, request.body,
              { discourse, scope, route });
          scope.target = server.patchResource(vMapping, request.body.$V.target,
              { discourse, scope, route, toPatchTarget: this.toPatchTarget });
        },
        () => discourse && discourse.releaseFabricator(),
        eventResult => eventResult
            && eventResult.getPersistedEvent(),
        (/* persistedEvent */) => {
          const targetId = scope.mapping.get("target").getRawId();
          const results = {
            $V: {
              href: `${server.getResourceHRefPrefix(route.config.resourceSchema)}${
                scope.resourceId}/${scope.mappingName}/${targetId}`,
              rel: "self",
              target: { $V: {
                href: `${server.getResourceHRefPrefix(route.config.targetSchema)}${targetId}`,
                rel: "self",
              } },
            }
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
        if (discourse) discourse.releaseFabricator({ abort: error });
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
