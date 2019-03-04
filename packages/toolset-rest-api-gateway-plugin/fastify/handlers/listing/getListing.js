// @flow

import type RestAPIServer, { Route } from "~/toolset-rest-api-gateway-plugin/fastify/RestAPIServer";

import { dumpify, dumpObject, thenChainEagerly } from "~/tools";

export default function createRouteHandler (server: RestAPIServer, route: Route) {
  return {
    category: "listing", method: "GET", fastifyRoute: route,
    requiredRules: [],
    builtinRules: {},
    prepare (/* fastify */) {
      try {
        this.scopeRules = server.prepareScopeRules(this);
        this.toPreloads = ["§->"];
        if (!server.addSchemaStep(route.config, this.toPreloads)) {
          if (route.config.valos.hardcodedResources) return;
          throw new Error(`Route listing GET <${route.url}> is missing valos schema predicate`);
        }
        const relationsIndex = this.toPreloads.indexOf("relations");
        if (relationsIndex === -1) throw new Error("Can't locate toPreloads 'relations' section");
        // replace everything after relations + its name filter with a §map for $V.target
        this.toPreloads.splice(relationsIndex + 2, this.toPreloads.length,
            ["§map", false, "target"]);
        this.toListingFields = ["§->"];
        server.buildKuery({ ...route.schema.response[200], valos: route.config.valos },
            this.toListingFields);
        if (route.config.valos.filter) {
          this.toListingFields.push(["§filter", route.config.valos.filter]);
        }
      } catch (error) {
        throw server.wrapErrorEvent(error, new Error(`prepare(${this.name})`),
            "\n\ttoPreloads:", dumpify(this.toPreloads, { indent: 2 }),
        );
      }
    },
    async preload () {
      let vIndexRoot, vTargets;
      try {
        const connection = await server.getDiscourse()
            .acquirePartitionConnection(route.config.valos.subject, { newPartition: false })
            .getActiveConnection();
        vIndexRoot = server.getEngine().getVrapper([
          connection.getPartitionRawId(), { partition: String(connection.getPartitionURI()) },
        ]);
        server.warnEvent("Preloading route:", this.name,
            "\n\tpreload kuery:", JSON.stringify(this.toPreloads),
            "\n\troute root:", vIndexRoot.debugId());
        vTargets = vIndexRoot.get(this.toPreloads) || [];
        server.warnEvent("Activating route:", this.name,
            "\n\tresources:", ...[].concat(...vTargets.map(vTarget => (!vTarget ? ["\n\t: <null>"]
                : ["\n\t:", vTarget.debugId()]))));
        await Promise.all(vTargets.map(vTarget => vTarget.activate()));
        server.infoEvent("Done preloading route:", this.name,
            "\n\tresources:", ...[].concat(...vTargets.map(vTarget => (!vTarget
                ? ["\n\t: <null>"] : [
              "\n\t:", vTarget.debugId(),
              "\n\t\t:", vTarget.getPartitionConnection().isActive(),
                  String(vTarget.getPartitionConnection().getPartitionURI()),
            ]))));
        this.scopeRules.scopeBase = Object.freeze({
          ...this.scopeRules.scopeBase,
          indexRoot: vIndexRoot,
        });
      } catch (error) {
        throw server.wrapErrorEvent(error, new Error(`preload(${this.name})`),
            "\n\tvIndexRoot:", ...dumpObject(vIndexRoot),
            "\n\ttoPreloads:", dumpify(this.toPreloads, { indent: 2 }),
            "\n\tvTargets:", ...dumpObject(vTargets),
        );
      }
    },
    handleRequest (request, reply) {
      const scope = server.buildRequestScope(request, this.scopeRules);
      const {
        filter, // unimplemented
        sort, offset, limit, ids,
        fields,
        // Assumes all remaining query params are field requirements.
        // Relies on schema validation to reject garbage params.
        ...fieldRequirements
      } = request.query;
      server.infoEvent(1, () => [
        `${this.name}:`,
        "\n\trequest.query:", request.query,
        "\n\troute.schema.response[200]:", ...dumpObject(route.schema.response[200]),
        "\n\tkuery:", ...dumpObject(this.toListingFields),
        "\n\troute.config:", ...dumpObject(route.config),
      ]);
      return thenChainEagerly(scope.indexRoot, [
        vIndexRoot => vIndexRoot.get(this.toListingFields, { scope }),
        (filter || ids || Object.keys(fieldRequirements).length)
            && (results => _filterResults(results, filter, ids, fieldRequirements)),
        (sort)
            && (results => _sortResults(results, sort)),
        (offset || (limit !== undefined))
            && (results => _paginateResults(results, offset || 0, limit)),
        (fields)
            && (results => server._pickResultFields(results, fields, route.schema.response[200])),
        results => JSON.stringify(results, null, 2),
        results => {
          reply.code(200);
          reply.send(results);
          server.infoEvent(2, () => [
            `${this.name}:`,
            "\n\tresults:", ...dumpObject(results),
          ]);
          return true;
        },
      ]);
    },
  };
}

function _filterResults (results, filter, ids, fieldRequirements) {
  const idLookup = ids
      && ids.split(",").reduce((lookup, id) => (lookup[id] = true) && lookup, {});
  let requirementCount = 0;
  const requiredFields = [];
  Object.entries(fieldRequirements).forEach(([fieldName, requirements]) => {
    if (!requirements) return;
    const requireFieldName = (fieldName.match(/require-(.*)/) || [])[1];
    if (!requireFieldName) return;
    const requiredIds = {};
    requirements.split(",").forEach(targetId => {
      const condition = true; // This can have a more elaborate condition in the future
      if (requiredIds[targetId]) {
        if (requiredIds[targetId] === condition) return; // just ignore duplicates
        throw new Error(`Complex compount field requirements for ${fieldName}=${targetId
            } are not implemented, {${condition}} requested, {${requiredIds[targetId]}
            } already exists`);
      }
      requiredIds[targetId] = condition;
      ++requirementCount;
    });
    requiredFields.push([requireFieldName, requiredIds]);
  });
  return results.filter(result => {
    if (result == null) return false;
    // TODO(iridian, 2019-02): This is O(n) where n is the number
    // of all matching route resources in corpus befor filtering,
    // not the number of requested resources. Improve.
    if (idLookup && !idLookup[(result.$V || {}).id]) return false;

    let satisfiedRequirements = 0;
    for (const [fieldName, requiredIds] of requiredFields) {
      const remainingRequiredIds = Object.create(requiredIds);
      for (const sequenceEntry of (result[fieldName] || [])) {
        const currentHref = ((sequenceEntry || {}).$V || {}).href;
        const currentId = currentHref && (currentHref.match(/\/([a-zA-Z0-9\-_.~]+)$/) || [])[1];
        // Check for more elaborate condition here in the future
        if (remainingRequiredIds[currentId]) {
          // Prevent multiple relations with same target from
          // incrementing satisfiedRequirements
          remainingRequiredIds[currentId] = false;
          ++satisfiedRequirements;
        }
      }
    }
    return satisfiedRequirements === requirementCount;
  });
}

function _sortResults (results, sort) {
  const sortKeys = sort.split(",");
  const order = sortKeys.map((key, index) => {
    if (key[0] !== "-") return 1;
    sortKeys[index] = key.slice(1);
    return -1;
  });
  results.sort((l, r) => {
    for (let i = 0; i !== sortKeys.length; ++i) {
      const key = sortKeys[i];
      if (l[key] === r[key]) continue;
      return ((l[key] < r[key]) ? -1 : 1) * order[i];
    }
    return 0;
  });
  return results;
}

function _paginateResults (results, offset, limit) {
  return results.slice(offset || 0, limit && ((offset || 0) + limit));
}
