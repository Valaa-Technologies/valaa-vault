// @flow

import path from "path";

import { asyncConnectToPartitionsIfMissingAndRetry } from "~/raem/tools/denormalized/partitions";
import { dumpify, dumpObject, LogEventGenerator, outputError } from "~/tools";
import VALEK from "~/engine/VALEK";

const Fastify = require("fastify");
const FastifySwaggerPlugin = require("fastify-swagger");

export default class RestAPIServer extends LogEventGenerator {
  constructor ({ view, viewName, port, address, fastify, prefixes, ...rest }) {
    super({ logger: view._gateway.getLogger(), ...rest });
    this._view = view;
    this._viewName = viewName;
    this._engine  = view.engine;
    this._gateway = view._gateway;

    this._port = port;
    this._address = address;
    this._prefixes = prefixes;
    this._fastify = Fastify(fastify || {});
  }

  async start () {
    const wrap = new Error(`start`);
    try {
      this._prefixPlugins = await Promise.all(Object.entries(this._prefixes)
          .map(this._createPrefixPlugin));
      this._fastify.listen(this._port, this._address || undefined, (error) => {
        if (error) throw error;
        this.infoEvent(1, `listening @`, this._fastify.server.address(), "exposing prefixes:",
            ...[].concat(...Object.entries(this._prefixes).map(
                ([prefix, { openapi: { info: { name, title, version } } }]) =>
                    [`\n\t${prefix}:`, `${name}@${version} -`, title]
            )));
      });
    } catch (error) {
      throw this.wrapErrorEvent(error, wrap,
          "\n\tprefixes:", ...dumpObject(this._prefixes));
    }
  }

  _createPrefixPlugin = async ([prefix, {
    openapi, swaggerPrefix, schemas, routes, ...pluginOptions
  }]) => {
    const server = this;
    const wrap = new Error(
        `createPrefixPlugin(${openapi.info.name}@${openapi.info.version}:"${prefix}")`);
    try {
      const prefixedThis = Object.create(this);
      prefixedThis._prefix = prefix;
      // Create default handlers and preload route resources
      await Promise.all(routes.map(route => prefixedThis._preloadRouteResources(route)));
      // https://github.com/fastify/fastify/blob/master/docs/Server.md
      prefixedThis._fastify.register((fastify, opts, next) => {
        try {
          if (swaggerPrefix) {
            fastify.register(FastifySwaggerPlugin, {
              routePrefix: swaggerPrefix,
              exposeRoute: true,
              swagger: openapi,
            });
          }
          schemas.forEach(schema => fastify.addSchema(schema));
          routes.forEach(route => {
            if (typeof route.handler === "string") {
              route.handler = prefixedThis._createRouteHandler(route);
            }
            fastify.route(route);
          });
          fastify.ready(err => {
            if (err) throw err;
            fastify.swagger();
          });
        } catch (error) {
          const wrapped = errorOnCreatePrefixPlugin(error);
          outputError(wrapped, "Exception caught during plugin register");
          throw wrapped;
        }
        next();
      }, {
        prefix,
        ...pluginOptions,
      });
      prefixedThis._fastify.after(error => {
        if (error) {
          outputError(errorOnCreatePrefixPlugin(error), "Exception caught after plugin register");
        }
      });
    } catch (error) { throw errorOnCreatePrefixPlugin(error); }
    function errorOnCreatePrefixPlugin (error) {
      return server.wrapErrorEvent(error, wrap,
        "\n\topenapi:", ...dumpObject(openapi),
        "\n\tswaggerPrefix:", swaggerPrefix,
        "\n\tschemas:", ...dumpObject(schemas),
        "\n\troutes:", ...dumpObject(routes));
    }
  }

  _preloadRouteResources (route) {
    const wrap = new Error(`createRouteHandler(${route.method} ${route.url})`);
    try {
      if (!route.handler) {
        throw new Error(`Route ${route.method} <${route.url}>: handler type missing`);
      }
      const preloader = this[`${route.handler}${route.method}Preload`];
      return preloader && preloader.call(this, route);
    } catch (error) {
      throw this.wrapErrorEvent(error, wrap, "\n\troute:", dumpify(route, { indent: 2 }));
    }
  }

  _createRouteHandler (route) {
    const wrap = new Error(`createRouteHandler(${route.method} ${route.url})`);
    try {
      if (!route.handler) {
        throw new Error(`Route ${route.method} <${route.url}>: handler type missing`);
      }
      const createHandler = this[`${route.handler}${route.method}Handler`];
      if (!createHandler) {
        throw new Error(`Unrecognized handler '${route.handler}${route.method}Handler'`);
      }
      const routeErrorMessage = `Exception caught during ${route.method} ${route.url}`;
      const handler = createHandler.call(this, route);
      return asyncConnectToPartitionsIfMissingAndRetry(handler, (error, request, reply) => {
        reply.code(500);
        reply.send(error.message);
        outputError(this.wrapErrorEvent(error, new Error(`${route.method} ${route.url}`),
            "\n\trequest.params:", ...dumpObject(request.params),
            "\n\trequest.query:", ...dumpObject(request.query),
            "\n\trequest.body:", ...dumpObject(request.body),
        ), routeErrorMessage, this.getLogger());
      });
    } catch (error) {
      throw this.wrapErrorEvent(error, wrap, "\n\troute:", dumpify(route, { indent: 2 }));
    }
  }

  async listCollectionGETPreload (route) {
    const connection = await this._engine.discourse.acquirePartitionConnection(
        route.config.valos.subject, { newConnection: false }).getActiveConnection();
    route.vRoot = this._engine.getVrapper([
      connection.getPartitionRawId(), { partition: String(connection.getPartitionURI()) },
    ]);
    const listKuery = ["§->"];
    if (!this._extractValOSSchemaKuery(route.config.valos, listKuery)) {
      throw new Error(`Route <${route.url}> is missing valos schema predicate`);
    }
    listKuery.splice(listKuery.indexOf("relations") + 2);
    listKuery.push(["§map", false, "target"]);
    this.warnEvent("preloading route:", route.method, route.url,
        "\n\tpreload kuery:", JSON.stringify(listKuery),
        "\n\troute root:", route.vRoot.debugId());
    const vTargets = route.vRoot.get(listKuery);
    this.warnEvent("activating route resources:", route.method, route.url,
        "\n\tresources:", ...[].concat(...vTargets.map(vTarget => (!vTarget ? ["\n\t: <null>"]
            : ["\n\t:", vTarget.debugId()]))));
    await Promise.all(vTargets.map(vTarget => vTarget.activate()));
    this.logEvent("done activating route resources:", route.method, route.url,
        "\n\tresources:", ...[].concat(...vTargets.map(vTarget => (!vTarget ? ["\n\t: <null>"] : [
          "\n\t:", vTarget.debugId(),
          "\n\t\t:", vTarget.getPartitionConnection().isActive(),
              String(vTarget.getPartitionConnection().getPartitionURI()),
        ]))));
  }


  listCollectionGETHandler (route) {
    const kuery = ["§->"];
    this._buildKuery({ ...route.schema.response[200], valos: route.config.valos }, kuery);

    return (request, reply) => {
      const {
        filter, // unimplemented
        sort, offset, limit, ids, fields,
        // Assumes all remaining query params are field requirements.
        // Relies on schema validation to filter out garbage params.
        ...fieldRequirements
      } = request.query;
      this.logEvent(1, () => ["listCollection GET", route.url,
          "\n\trequest.query:", request.query,
          "\n\troute.schema.response[200]:", ...dumpObject(route.schema.response[200]),
          "\n\tkuery:", ...dumpObject(kuery),
          "\n\troute.config:", ...dumpObject(route.config),
      ]);
      let results = route.vRoot.get(kuery, {});
      if (filter || ids || Object.keys(fieldRequirements).length) {
        results = this._filterResults(results, filter, ids, fieldRequirements);
      }
      if (sort) {
        results = this._sortResults(results, sort);
      }
      if (offset || (limit !== undefined)) {
        results = this._paginateResults(results, offset || 0, limit);
      }
      if (fields) {
        results = this._pickResultsFields(results, fields);
      }
      results = JSON.stringify(results, null, 2);
          // "\n\tschema:", JSON.stringify(route.schema.response[200], null, 2),
      this.logEvent(1, () => ["listCollection GET", route.url,
          "\n\tresults:", ...dumpObject(results)]);
      reply.send(results);
      // reply.code(200);
      // reply.send([]);
    };
  }

  _filterResults (results, filter, ids, fieldRequirements) {
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

  _sortResults (results, sort) {
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

  _paginateResults (results, offset, limit) {
    return results.slice(offset || 0, limit && ((offset || 0) + limit));
  }

  _pickResultsFields (results, fields) {
    const fieldNames = fields.split(",");
    return results.map(entry => {
      const ret = {};
      for (const name of fieldNames) {
        const value = entry[name];
        if (value !== undefined) ret[name] = value;
      }
      return ret;
    });
  }

  retrieveResourceGETHandler (route) {
    // const connection = await this._engine.discourse.acquirePartitionConnection(
    //    route.config.valos.subject, { newConnection: false }).getActiveConnection();
    // const vRoot = this._engine.getVrapper([connection.getPartitionRawId()]);

    const kuery = ["§->"];
    this._buildKuery(route.schema.response[200], kuery);

    return (request, reply) => {
      const resourceId = request.params[route.config.idRouteParam];
      this.logEvent(1, () => ["retrieveResource GET", route.url, resourceId,
          "\n\trequest.query:", request.query]);
      const vResource = this._engine.tryVrapper([resourceId]);
      if (!vResource) {
        reply.code(404);
        reply.send(`Resource not found: <${resourceId}>`);
      } else {
        const { fields } = request.query;
        let result = vResource.get(kuery, { verbosity: 0 });
        if (fields) {
          result = this._pickResultsFields([result], fields)[0];
        }
        reply.send(JSON.stringify(result, null, 2));
      }
    };
  }

  createResourcePOSTHandler (route) {
    // const connection = await this._engine.discourse.acquirePartitionConnection(
    //    route.config.valos.subject, { newConnection: false }).getActiveConnection();
    // const vRoot = this._engine.getVrapper([connection.getPartitionRawId()]);
    return (request, reply) => {
      this.logEvent("createResource POST", route.url,
        "\n\trequest.body:", request.body);
      reply.code(403);
      reply.send("Denied");
    };
  }

  updateResourcePATCHHandler (route) {
    // const connection = await this._engine.discourse.acquirePartitionConnection(
    //    route.config.valos.subject, { newConnection: false }).getActiveConnection();
    // const vRoot = this._engine.getVrapper([connection.getPartitionRawId()]);
    return (request, reply) => {
      const resourceId = request.params[route.config.idRouteParam];
      this.logEvent("updateResource PATCH", route.url, resourceId,
          "\n\trequest.body:", request.body);
      reply.code(403);
      reply.send("Denied");
    };
  }

  destroyResourceDELETEHandler (route) {
    // const connection = await this._engine.discourse.acquirePartitionConnection(
    //    route.config.valos.subject, { newConnection: false }).getActiveConnection();
    // const vRoot = this._engine.getVrapper([connection.getPartitionRawId()]);
    return (request, reply) => {
      const resourceId = request.params[route.config.idRouteParam];
      this.logEvent("destroyResource DELETE", route.url, resourceId);
      reply.code(403);
      reply.send("Denied");
    };
  }

  _buildKuery (jsonSchema, outerKuery, isValOSFields) {
    let innerKuery;
    try {
      if (typeof jsonSchema === "string") {
        const sharedSchema = this._fastify.getSchemas()[jsonSchema.slice(0, -1)];
        if (!sharedSchema) throw new Error(`Can't resolve shared schema "${jsonSchema}"`);
        return this._buildKuery(sharedSchema, outerKuery, isValOSFields);
      }
      innerKuery = this._extractValOSSchemaKuery(jsonSchema.valos, outerKuery);
      if (jsonSchema.type === "array") {
        if (!innerKuery) {
          throw new Error("json schema valos predicate missing with json schema type 'array'");
        }
        this._buildKuery(jsonSchema.items, innerKuery);
      } else if (jsonSchema.type === "object") {
        const objectKuery = {};
        Object.entries(jsonSchema.properties).forEach(([key, valueSchema]) => {
          let op;
          if (isValOSFields) {
            if (key === "id") op = ["§->", "rawId"];
            else if (key === "href") {
              if (!(jsonSchema.valos.route || {}).name) {
                throw new Error("href requested without json schema valos routeName");
              }
              op = ["§->", "target", false, "rawId", [
                "§+", path.join("/", this._prefix, jsonSchema.valos.route.name, "/"), ["§->", null],
              ]];
            } else if (key === "rel") op = "self";
            else op = ["§->", key];
          } else if (key === "$V") {
            this._buildKuery(valueSchema, (op = ["§->"]), true);
          } else {
            this._buildKuery(valueSchema, (op = ["§->"]));
            op = (op.length === 1) ? ["§..", key]
                : (valueSchema.type === "array") ? op
                : ["§->", ["§..", key], false, ...op.slice(1)];
          }
          objectKuery[key] = op;
        });
        (innerKuery || outerKuery).push(objectKuery);
      }
      return outerKuery;
    } catch (error) {
      throw this.wrapErrorEvent(error, new Error("_buildKuery"),
          "\n\tjsonSchema:", ...dumpObject(jsonSchema),
          "\n\touterKuery:", ...dumpObject(outerKuery),
          "\n\tinnerKuery:", ...dumpObject(innerKuery));
    }
  }

  _extractValOSSchemaKuery (valosSchema, outerKuery) {
    if (!(valosSchema || {}).predicate) return undefined;
    return valosSchema.predicate.split("!").reduce((innerKuery, part) => {
      if (innerKuery.length > 1) innerKuery.push(false);
      const fieldName = (part.match(/^(valos:field:|\$V:)(.*)$/) || [])[2];
      if (fieldName) {
        innerKuery.push(decodeURIComponent(fieldName));
        return innerKuery;
      }
      const propertyName = (part.match(/^(valos:Property:|\.:)(.*)$/) || [])[2];
      if (propertyName) {
        innerKuery.push(["§..", decodeURIComponent(propertyName)]);
        return innerKuery;
      }
      const relationName = (part.match(/^(valos:Relation:|-:)(.*)$/) || [])[2];
      if (relationName) {
        innerKuery.push(...VALEK.relations(relationName).toVAKON().slice(1));
        const mapper = ["§map"];
        innerKuery.push(mapper);
        return mapper;
      }
      throw new Error(`Unrecognized part <${part}> in valos predicate <${valosSchema.predicate}>`);
    }, outerKuery);
  }
}
