// @flow

import type MapperService, { Route } from "~/rest-api-spindle/fastify/MapperService";

import { dumpify, dumpObject, thenChainEagerly } from "~/tools";

import { _presolveRouteRequest } from "../_handlerOps";

export default function createRouter (mapper: MapperService, route: Route) {
  return {
    requiredRules: ["routeRoot"],

    prepare (/* fastify */) {
      try {
        this.runtime = mapper.createRouteRuntime(this);
        this.toPreloads = ["§->"];
        if (!mapper.addSchemaStep(route.config, this.toPreloads)) {
          if (route.config.valos.hardcodedResources) return;
          throw new Error(`Route listing GET <${route.url}> is missing valos schema predicate`);
        }
        const relationsIndex = this.toPreloads.indexOf("relations");
        if (relationsIndex === -1) throw new Error("Can't locate toPreloads 'relations' section");
        // replace everything after relations + its name filter with a §map for $V.target
        this.toPreloads.splice(relationsIndex + 2, this.toPreloads.length,
            ["§map", false, "target"]);
        this.toListingFields = ["§->"];
        mapper.buildKuery({ ...route.schema.response[200], valos: route.config.valos },
            this.toSuccessFields);
        if (route.config.valos.filter) {
          this.toListingFields.push(["§filter", route.config.valos.filter]);
        }
      } catch (error) {
        throw mapper.wrapErrorEvent(error, new Error(`prepare(${this.name})`),
            "\n\ttoPreloads:", dumpify(this.toPreloads, { indent: 2 }),
        );
      }
    },
    async preload () {
      let vIndexRoot, vTargets;
      try {
        const connection = await mapper.getDiscourse()
            .acquireConnection(route.config.valos.subject, { newPartition: false })
            .asActiveConnection();
        vIndexRoot = mapper.getEngine().getVrapper([
          connection.getPartitionRawId(), { partition: String(connection.getPartitionURI()) },
        ]);
        mapper.warnEvent("Preloading route:", this.name,
            "\n\tpreload kuery:", JSON.stringify(this.toPreloads),
            "\n\troute root:", vIndexRoot.debugId());
        vTargets = vIndexRoot.get(this.toPreloads) || [];
        mapper.warnEvent("Activating route:", this.name,
            "\n\tresources:", ...[].concat(...vTargets.map(vTarget => (!vTarget ? ["\n\t: <null>"]
                : ["\n\t:", vTarget.debugId()]))));
        await Promise.all(vTargets.map(vTarget => vTarget && vTarget.activate())
            .concat(mapper.preloadRuntimeResources(this.routeRuntime)));

        mapper.infoEvent("Done preloading route:", this.name,
            "\n\tresources:", ...[].concat(...vTargets.map(vTarget => (!vTarget
                ? ["\n\t: <null>"] : [
              "\n\t:", vTarget.debugId(),
              "\n\t\t:", vTarget.getConnection().isActive(),
                  String(vTarget.getConnection().getPartitionURI()),
            ]))));
        this.routeRuntime.scopeBase = Object.freeze({
          subject: vIndexRoot,
          indexRoot: vIndexRoot,
          ...this.routeRuntime.scopeBase,
        });
      } catch (error) {
        throw mapper.wrapErrorEvent(error, new Error(`preload(${this.name})`),
            "\n\tvIndexRoot:", ...dumpObject(vIndexRoot),
            "\n\ttoPreloads:", dumpify(this.toPreloads, { indent: 2 }),
            "\n\tvTargets:", ...dumpObject(vTargets),
        );
      }
    },

    handler (request, reply) {
      const valkOptions = mapper.buildRuntimeVALKOptions(this, this.runtime, request, reply);
      const scope = valkOptions.scope;
      if (_presolveRouteRequest(mapper, route, this.runtime, valkOptions)) {
        return true;
      }
      mapper.infoEvent(1, () => [
        `${this.name}:`,
        "\n\trequest.query:", ...dumpObject(request.query),
        "\n\troute.config:", ...dumpObject(route.config),
        "\n\troute.schema.response[200]:", ...dumpObject(route.schema.response[200]),
        "\n\ttoSuccessBodyFields:", ...dumpObject(this.toSuccessBodyFields),
      ]);
      const {
        filter, // unimplemented
        sort, offset, limit, ids,
        fields,
        // Assumes all remaining query params are field requirements.
        // Relies on schema validation to reject garbage params.
        ...fieldRequirements
      } = request.query;
      return thenChainEagerly(scope.routeRoot, [
        vRouteRoot => vRouteRoot.get(this.toSuccessBodyFields, valkOptions),
        (filter || ids || Object.keys(fieldRequirements).length)
            && (results => mapper.filterResults(results, filter, ids, fieldRequirements)),
        (sort)
            && (results => mapper.sortResults(results, sort)),
        (offset || (limit !== undefined))
            && (results => mapper.paginateResults(results, offset || 0, limit)),
        (fields)
            && (results => mapper.pickResultFields(results, fields, route.schema.response[200])),
        results => JSON.stringify(results, null, 2),
        results => {
          mapper.infoEvent(2, () => [
            `${this.name}:`,
            "\n\tresults:", ...dumpObject(results),
          ]);
          reply.code(200);
          reply.send(results);
          return true;
        },
      ]);
    },
  };
}
