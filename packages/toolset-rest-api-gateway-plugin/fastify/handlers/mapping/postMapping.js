// @flow

import type RestAPIServer, { Route } from "~/toolset-rest-api-gateway-plugin/fastify/RestAPIServer";
import { dumpObject, thenChainEagerly } from "~/tools";

import { _createToMappingsParts } from "./_mappingHandlerOps";

export default function createRouteHandler (server: RestAPIServer, route: Route) {
  return {
    category: "mapping", method: "POST", fastifyRoute: route,
    requiredRules: ["resourceId", "mappingName"],
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
      // const connection = await server.getDiscourse().acquirePartitionConnection(
      //    route.config.valos.subject, { newPartition: false }).getActiveConnection();
      // const vRoot = server.getEngine().getVrapper([connection.getPartitionRawId()]);
      this.vPreloads = server.preloadVAKONRefResources(route.config.scope);
      server.preloadVAKONRefResources(route.config.createResourceAndMapping, this.vPreloads);
      await Promise.all(this.vPreloads.map(vPreload => vPreload.activate()));
      const scriptRoot = this.vPreloads[0] || server.getViewFocus();
      if (!scriptRoot) throw new Error(`Can't locate scriptRoot for route: ${this.name}`);
      this.scopeRules.scopeBase = Object.freeze({
        ...this.scopeRules.scopeBase,
        scriptRoot,
      });
    },
    handleRequest (request, reply) {
      const scope = server.buildRequestScope(request, this.scopeRules);

      server.infoEvent(1, () => [
        `${this.name}:`, scope.resourceId, scope.mappingName,
        "\n\trequest.query:", request.query,
        "\n\trequest.body:", request.body,
        "\n\ttoSource:", ...dumpObject(this.toSource),
        "\n\ttoPatchTarget:", ...dumpObject(this.toPatchTarget),
      ]);
      if (!scope.createResourceAndMapping) {
        reply.code(405);
        reply.send(`${this.name} is disabled: no configuration for resource and mapping creation`);
        return false;
      }
      const targetName = ((request.body.$V || {}).target || {}).name;

      if (typeof targetName !== "string") {
        reply.code(400);
        reply.send(`Required body.$V.target.name string field is missing or malformed`);
        return false;
      }

      scope.resource = server._engine.tryVrapper([scope.resourceId]);
      if (!scope.resource) {
        reply.code(404);
        reply.send(`No such ${route.config.resourceTypeName} route resource: ${scope.resourceId}`);
        return false;
      }

      const wrap = new Error(`mapping POST ${route.url}`);
      const discourse = undefined; // server.getDiscourse().acquireTransaction();
      return thenChainEagerly(discourse, [
        () => {
          scope.source = !this.toSource
              ? scope.resource
              : scope.resource.get(this.toSource, { discourse, scope });
          // Replace with createMapping call proper. Now using old idiom
          // and explicit instantiate.
          console.log("POST stuff:", scope.createResourceAndMapping,
              "\n\tscriptRoot:", scope.scriptRoot && scope.scriptRoot.debugId(),
              "\n\tsource:", scope.source && scope.source.debugId(),
              "\n\tname:", targetName);
          return scope.scriptRoot.do(scope.createResourceAndMapping, { discourse, scope });
        },
        vMapping => {
          scope.mapping = server.patchResource(vMapping, request.body,
              { discourse, scope, route });
          scope.target = server.patchResource(vMapping, request.body.$V.target,
              { discourse, scope, route, toPatchTarget: this.toPatchTarget });
        },
        () => discourse && discourse.releaseTransaction(),
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
