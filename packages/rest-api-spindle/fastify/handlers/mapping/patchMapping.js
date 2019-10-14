// @flow

import type MapperService, { Route } from "~/rest-api-spindle/fastify/MapperService";
import { dumpObject, thenChainEagerly } from "~/tools";

import { _createTargetedToMappingFields, _resolveMappingResource } from "./_mappingHandlerOps";

export default function createRouteHandler (mapper: MapperService, route: Route) {
  return {
    category: "mapping", method: "PATCH", fastifyRoute: route,
    requiredRuntimeRules: ["resourceId", "mappingName", "targetId"],
    builtinRules: {
      mappingName: ["constant", route.config.mappingName],
      createMapping: ["constant", route.config.createMapping],
    },
    prepare (/* fastify */) {
      this.routeRuntime = mapper.createRouteRuntime(this);
      const { toMappingFields, relationsStepIndex } =
          _createTargetedToMappingFields(mapper, route, ["~$:targetId"]);
      if (relationsStepIndex > 1) this.toSource = toMappingFields.slice(0, relationsStepIndex);
      this.toMapping = toMappingFields.slice(0, -2).concat(0);
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
        `${this.name}:`, scope.resourceId, scope.mappingName, scope.targetId,
        "\n\trequest.query:", request.query,
        "\n\trequest.body:", request.body,
      ]);
      if (_resolveMappingResource(mapper, route, request, reply, scope)) return true;
      const vExistingMapping = scope.resource.get(this.toMapping, { scope });
      if (!vExistingMapping) {
        if (!scope.createMapping) {
          reply.code(405);
          reply.send(`${this.name} CREATE is disabled: no configuration for mapping creation`);
          return true;
        }
        scope.target = mapper._engine.tryVrapper([scope.targetId]);
        if (!scope.target) {
          reply.code(404);
          reply.send(`No such ${route.config.targetTypeName} route target: ${scope.targetId}`);
          return true;
        }
      }
      const wrap = new Error(this.name);
      const discourse = mapper.getDiscourse().acquireFabricator();
      return thenChainEagerly(discourse, [
        () => {
          if (vExistingMapping) return vExistingMapping;
          // vSource is not needed if the mapping was found already
          scope.source = !this.toSource ? scope.resource
              : scope.resource.get(this.toSource, { scope, discourse });
          // Replace with createMapping call proper. Now using old idiom
          // and explicit instantiate.
          return scope.viewFocus.do(scope.createMapping, { discourse, scope });
        },
        vMapping => mapper.updateResource((scope.mapping = vMapping), request.body,
            { discourse, scope, route }),
        () => discourse.releaseFabricator(),
        eventResult => eventResult
            && eventResult.getPersistedEvent(),
        (/* persistedEvent */) => {
          const results = {
            $V: {
              href: `${mapper.getResourceHRefPrefix(route.config.resourceSchema)}${
                scope.resourceId}/${scope.mappingName}/${scope.targetId}`,
              rel: "self",
              target: { $V: {
                href: `${mapper.getResourceHRefPrefix(route.config.targetSchema)}${
                  scope.targetId}`,
                rel: "self",
              } },
            }
          };
          reply.code(vExistingMapping ? 200 : 201);
          reply.send(JSON.stringify(results, null, 2));
          mapper.infoEvent(2, () => [
            `${this.name}:`,
            "\n\tresults:", ...dumpObject(results),
          ]);
          return true;
        },
      ], (error) => {
        discourse.releaseFabricator({ abort: error });
        throw mapper.wrapErrorEvent(error, wrap,
          "\n\trequest.query:", ...dumpObject(request.query),
          "\n\trequest.body:", ...dumpObject(request.body),
          "\n\tscope.resource:", ...dumpObject(scope.resource),
          "\n\tscope.source:", ...dumpObject(scope.source),
          "\n\tscope.mapping:", ...dumpObject(scope.mapping),
          "\n\tscope.target:", ...dumpObject(scope.target),
          "\n\trouteRuntime:", ...dumpObject(this.routeRuntime),
        );
      });
    },
  };
}
