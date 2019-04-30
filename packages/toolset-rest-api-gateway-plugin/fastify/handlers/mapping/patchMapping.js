// @flow

import type RestAPIServer, { Route } from "~/toolset-rest-api-gateway-plugin/fastify/RestAPIServer";
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
      // const connection = await server.getDiscourse().acquirePartitionConnection(
      //    route.config.valos.subject, { newPartition: false }).getActiveConnection();
      // const vRoot = server.getEngine().getVrapper([connection.getPartitionRawId()]);
      this.vPreloads = server.preloadVAKONRefResources(route.config.createMapping);
      return Promise.all(this.vPreloads.map(vPreload => vPreload.activate()));
    },
    handleRequest (request, reply) {
      const scope = server.buildScope(request, this.scopeRules);
      server.infoEvent(1, () => [
        `${this.name}:`, scope.resourceId, scope.mappingName, scope.targetId,
        "\n\trequest.query:", request.query,
        "\n\trequest.body:", request.body,
      ]);
      if (!_resolveMappingResource(server, route, request, reply, scope)) return false;
      const vExistingMapping = scope.resource.get(this.toMapping, { scope });
      if (!vExistingMapping) {
        if (!scope.createMapping) {
          reply.code(405);
          reply.send(`${this.name} CREATE is disabled: no configuration for mapping creation`);
          return false;
        }
        scope.target = server._engine.tryVrapper([scope.targetId]);
        if (!scope.target) {
          reply.code(404);
          reply.send(`No such ${route.config.targetTypeName} route target: ${scope.targetId}`);
          return false;
        }
      }
      const wrap = new Error(this.name);
      const discourse = server.getDiscourse().acquireTransaction();
      return thenChainEagerly(discourse, [
        () => {
          if (vExistingMapping) return vExistingMapping;
          // vSource is not needed if the mapping was found already
          scope.source = !this.toSource ? scope.resource
              : scope.resource.get(this.toSource, { scope, discourse });
          // Replace with createMapping call proper. Now using old idiom
          // and explicit instantiate.
          return this.vPreloads[0].instantiate(
              { source: scope.source, target: scope.target }, { discourse });
        },
        vMapping => server.patchResource((scope.mapping = vMapping), request.body,
            { discourse, scope, route }),
        () => discourse.releaseTransaction(),
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
        discourse.releaseTransaction({ abort: error });
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
