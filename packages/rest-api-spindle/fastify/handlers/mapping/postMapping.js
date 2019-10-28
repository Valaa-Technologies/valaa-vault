// @flow

import type MapperService, { Route } from "~/rest-api-spindle/fastify/MapperService";
import { dumpObject, thenChainEagerly } from "~/tools";

import { _createToMappingsParts, _resolveMappingResource } from "./_mappingHandlerOps";

export default function createRouter (mapper: MapperService, route: Route) {
  return {
    requiredRules: ["routeRoot", "resource", "createResourceAndMapping"],
    rules: {
      mappingName: route && route.config.mapping.name,
    },

    prepare (/* fastify */) {
      this.runtime = mapper.createRouteRuntime(this);

      const { toMappingsResults, relationsStepIndex } = _createToMappingsParts(mapper, route);

      if (relationsStepIndex > 1) this.toSource = toMappingsResults.slice(0, relationsStepIndex);
      // const toMappingFields = _createToMappingFields(mapper, route);
      // toMappingFields.splice(-1);

      this.toPatchTarget = mapper
          .buildSchemaKuery(route.config.target.schema, ["§->", false, "target"])
          .slice(0, -1);
    },

    preload () {
      return mapper.preloadRuntimeResources(this, this.runtime);
    },

    handler (request, reply) {
      const { scope } = mapper.buildRuntimeVALKOptions(this, this.runtime, request, reply);
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
              "\n\tservice index:", ...dumpObject(scope.serviceIndex),
              "\n\tsource:", ...dumpObject(scope.source),
              "\n\tname:", targetName);
          return scope.serviceIndex.do(scope.createResourceAndMapping, { discourse, scope });
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
              href: `${mapper.getResourceHRefPrefix(route.config.resource.schema)}${
                scope.resourceId}/${scope.mappingName}/${targetId}`,
              rel: "self",
              target: { $V: {
                href: `${mapper.getResourceHRefPrefix(route.config.target.schema)}${targetId}`,
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
            "\n\trouteRuntime:", ...dumpObject(this.runtime),
        );
      });
    },
  };
}
