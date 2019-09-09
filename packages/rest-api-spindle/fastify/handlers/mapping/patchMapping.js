// @flow

import type RestAPIServer, { Route } from "~/rest-api-spindle/fastify/RestAPIServer";
import { dumpObject, thenChainEagerly } from "~/tools";

import { _createTargetedToMappingFields, _resolveMappingResource } from "./_mappingHandlerOps";

export default function createRouteHandler (server: RestAPIServer, route: Route) {
  return {
    category: "mapping", method: "PATCH", fastifyRoute: route,
    requiredRuntimeRules: ["resourceId", "mappingName", "targetId"],
    builtinRules: {
      mappingName: ["constant", route.config.mappingName],
      createMapping: ["constant", route.config.createMapping],
    },
    prepare (/* fastify */) {
      this.scopeRules = server.prepareScopeRules(this);
      const { toMappingFields, relationsStepIndex } =
          _createTargetedToMappingFields(server, route, ["~$:targetId"]);
      if (relationsStepIndex > 1) this.toSource = toMappingFields.slice(0, relationsStepIndex);
      this.toMapping = toMappingFields.slice(0, -2).concat(0);
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
        `${this.name}:`, scope.resourceId, scope.mappingName, scope.targetId,
        "\n\trequest.query:", request.query,
        "\n\trequest.body:", request.body,
      ]);
      if (_resolveMappingResource(server, route, request, reply, scope)) return true;
      const vExistingMapping = scope.resource.get(this.toMapping, { scope });
      if (!vExistingMapping) {
        if (!scope.createMapping) {
          reply.code(405);
          reply.send(`${this.name} CREATE is disabled: no configuration for mapping creation`);
          return true;
        }
        scope.target = server._engine.tryVrapper([scope.targetId]);
        if (!scope.target) {
          reply.code(404);
          reply.send(`No such ${route.config.targetTypeName} route target: ${scope.targetId}`);
          return true;
        }
      }
      const wrap = new Error(this.name);
      const discourse = server.getDiscourse().acquireFabricator();
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
        vMapping => server.patchResource((scope.mapping = vMapping), request.body,
            { discourse, scope, route }),
        () => discourse.releaseFabricator(),
        eventResult => eventResult
            && eventResult.getPersistedEvent(),
        (/* persistedEvent */) => {
          const results = {
            $V: {
              href: `${server.getResourceHRefPrefix(route.config.resourceSchema)}${
                scope.resourceId}/${scope.mappingName}/${scope.targetId}`,
              rel: "self",
              target: { $V: {
                href: `${server.getResourceHRefPrefix(route.config.targetSchema)}${
                  scope.targetId}`,
                rel: "self",
              } },
            }
          };
          reply.code(vExistingMapping ? 200 : 201);
          reply.send(JSON.stringify(results, null, 2));
          server.infoEvent(2, () => [
            `${this.name}:`,
            "\n\tresults:", ...dumpObject(results),
          ]);
          return true;
        },
      ], (error) => {
        discourse.releaseFabricator({ abort: error });
        throw server.wrapErrorEvent(error, wrap,
          "\n\trequest.query:", ...dumpObject(request.query),
          "\n\trequest.body:", ...dumpObject(request.body),
          "\n\tscope.resource:", ...dumpObject(scope.resource),
          "\n\tscope.source:", ...dumpObject(scope.source),
          "\n\tscope.mapping:", ...dumpObject(scope.mapping),
          "\n\tscope.target:", ...dumpObject(scope.target),
          "\n\tscopeRules:", ...dumpObject(this.scopeRules),
        );
      });
    },
  };
}
