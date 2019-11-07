// @flow

import type MapperService, { Route } from "~/rest-api-spindle/fastify/MapperService";
import { dumpObject, thenChainEagerly } from "~/tools";

import { _presolveResourceRouteRequest } from "../resource/_resourceHandlerOps";

export default function createRouter (mapper: MapperService, route: Route) {
  return {
    requiredRules: ["routeRoot", "resource", "doCreateMappingAndTarget"],
    rules: {
      mappingName: route && route.config.relation.name,
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
      const valkOptions = mapper.buildRuntimeVALKOptions(this, this.runtime, request, reply);
      if (_presolveResourceRouteRequest(mapper, route, this.runtime, valkOptions)) {
        return true;
      }
      const scope = valkOptions.scope;
      if (!scope.doCreateMappingAndTarget) {
        reply.code(405);
        reply.send(`${this.name} is disabled: no 'doCreateMappingAndTarget' rule`);
        return true;
      }
      const targetName = ((request.body.$V || {}).target || {}).name;
      mapper.infoEvent(1, () => [
        `${this.name}:`, ...dumpObject(scope.resource),
        `\n\t${scope.mappingName} new target name:`, ...dumpObject(targetName),
        "\n\trequest.query:", request.query,
        "\n\trequest.body:", request.body,
      ]);
      if (typeof targetName !== "string") {
        reply.code(400);
        reply.send(`Required body.$V.target.name field is missing or is not a string`);
        return true;
      }

      const wrap = new Error(`mapping POST ${route.url}`);
      valkOptions.route = route;
      valkOptions.discourse = mapper.getDiscourse().acquireFabricator();
      return thenChainEagerly(scope.resource, [
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
        () => valkOptions.discourse && valkOptions.discourse.releaseFabricator(),
        eventResult => eventResult && eventResult.getPersistedEvent(),
        (/* persistedEvent */) => {
          const targetId = scope.mapping.get("target").getRawId();
          const results = {
            $V: {
              href: `${mapper.getResourceHRefPrefix(route.config.resource.schema)
                }${scope.resource.getRawId()}/${scope.mappingName}/${targetId}`,
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
        if (valkOptions.discourse) valkOptions.discourse.releaseFabricator({ abort: error });
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
