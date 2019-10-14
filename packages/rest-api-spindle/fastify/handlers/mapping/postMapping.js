// @flow

import type MapperService, { Route } from "~/rest-api-spindle/fastify/MapperService";
import { dumpObject, thenChainEagerly } from "~/tools";

import { _createToMappingsParts, _resolveMappingResource } from "./_mappingHandlerOps";

export default function createRouteHandler (mapper: MapperService, route: Route) {
  return {
    category: "mapping", method: "POST", fastifyRoute: route,
    requiredRuntimeRules: ["resourceId", "mappingName"],
    builtinRules: {
      mappingName: ["constant", route.config.mappingName],
      createResourceAndMapping: ["constant", route.config.createResourceAndMapping],
    },
    prepare (/* fastify */) {
      this.routeRuntime = mapper.createRouteRuntime(this);
      const { toMappingsResults, relationsStepIndex } = _createToMappingsParts(mapper, route);

      if (relationsStepIndex > 1) this.toSource = toMappingsResults.slice(0, relationsStepIndex);
      // const toMappingFields = _createToMappingFields(mapper, route);
      // toMappingFields.splice(-1);

      this.toPatchTarget = ["§->", false, "target"];
      mapper.buildKuery(route.config.targetSchema, this.toPatchTarget);
      this.toPatchTarget.splice(-1);
    },
    async preload () {
      const viewFocus = mapper.getViewFocus();
      if (!viewFocus) throw new Error(`Can't locate viewFocus for route: ${this.name}`);
      await mapper.preloadRuntimeResources(this.routeRuntime);
      this.routeRuntime.scopeBase = Object.freeze({
        viewFocus,
        ...this.routeRuntime.scopeBase,
      });
    },
    handleRequest (request, reply) {
      const scope = mapper.buildRuntimeScope(this.routeRuntime, request);
      mapper.infoEvent(1, () => [
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

      if (_resolveMappingResource(mapper, route, request, reply, scope)) return true;

      const wrap = new Error(`mapping POST ${route.url}`);
      const discourse = undefined; // mapper.getDiscourse().acquireFabricator();
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
          scope.mapping = mapper.updateResource(vMapping, request.body,
              { discourse, scope, route });
          scope.target = mapper.updateResource(vMapping, request.body.$V.target,
              { discourse, scope, route, toPatchTarget: this.toPatchTarget });
        },
        () => discourse && discourse.releaseFabricator(),
        eventResult => eventResult
            && eventResult.getPersistedEvent(),
        (/* persistedEvent */) => {
          const targetId = scope.mapping.get("target").getRawId();
          const results = {
            $V: {
              href: `${mapper.getResourceHRefPrefix(route.config.resourceSchema)}${
                scope.resourceId}/${scope.mappingName}/${targetId}`,
              rel: "self",
              target: { $V: {
                href: `${mapper.getResourceHRefPrefix(route.config.targetSchema)}${targetId}`,
                rel: "self",
              } },
            }
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
