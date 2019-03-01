// @flow

import path from "path";

import { asyncConnectToPartitionsIfMissingAndRetry } from "~/raem/tools/denormalized/partitions";
import { dumpify, dumpObject, LogEventGenerator, outputError } from "~/tools";
import VALEK from "~/engine/VALEK";
import Vrapper from "~/engine/Vrapper";

import * as categoryOps from "./categoryOps";

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

  getEngine () { return this._engine; }
  getDiscourse () { return this._engine.discourse; }

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
            if (!route.handler) {
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
    const wrap = new Error(`createRouteHandler(${route.category || "<categoryless>"} ${
        route.method} ${route.url})`);
    try {
      if ((route.preload === undefined) && !route.category) {
        throw new Error(`Route ${route.method} <${route.url
            }>: both preload and category undefined (maybe set route.preload = null)`);
      }
      const preload = route.preload
          || ((categoryOps[route.category] || {})[route.method] || {}).preload;
      return preload && preload(this, route);
    } catch (error) {
      throw this.wrapErrorEvent(error, wrap, "\n\troute:", dumpify(route, { indent: 2 }));
    }
  }

  _createRouteHandler (route) {
    const wrap = new Error(`createRouteHandler(${route.category || "<categoryless>"} ${
        route.method} ${route.url})`);
    try {
      if (!route.category) {
        throw new Error(`Route ${route.method} <${route.url
            }>: both handler and category undefined`);
      }
      const createHandler = ((categoryOps[route.category] || {})[route.method] || {}).createHandler;
      if (!createHandler) {
        throw new Error(`Unrecognized handler '${route.category}${route.method}Handler'`);
      }
      const handler = createHandler(this, route);
      const routeErrorMessage = `Exception caught during ${route.method} ${route.url}`;
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

  _buildKuery (jsonSchema, outerKuery, isValOSFields) {
    let innerKuery;
    try {
      if (typeof jsonSchema === "string") {
        const sharedSchema = this._fastify.getSchemas()[jsonSchema.slice(0, -1)];
        if (!sharedSchema) throw new Error(`Can't resolve shared schema "${jsonSchema}"`);
        return this._buildKuery(sharedSchema, outerKuery, isValOSFields);
      }
      innerKuery = this._extractValOSSchemaKuery(jsonSchema.valos, outerKuery);
      const hardcoded = (innerKuery === undefined) && (jsonSchema.valos || {}).hardcodedResources;
      if (hardcoded) {
        outerKuery.push(["§'", Object.values(hardcoded).map(e => e)]);
        return outerKuery;
      }
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

  preloadVAKONRefResources (kuery, resultResources = []) {
    if ((kuery == null) || (typeof kuery !== "object")) return resultResources;
    if (!Array.isArray(kuery)) {
      Object.values(kuery).map(value => this.preloadVAKONRefResources(value, resultResources));
    } else if (kuery[0] !== "~ref") {
      kuery.map(value => this.preloadVAKONRefResources(value, resultResources));
    } else {
      const vResource = this.getEngine().getVrapper(kuery[1]);
      resultResources.push(vResource);
      vResource.activate();
    }
    return resultResources;
  }

  _patchResource (vResource, request, transaction /* , route */) {
    _patcher(vResource, request.body);
    function _patcher (vCurrent, patch) {
      Object.entries(patch).forEach(([propertyName, value]) => {
        if (value === undefined || (propertyName === "$V")) return;
        if (!value || (typeof value !== "object")) {
          vCurrent.alterProperty(propertyName, VALEK.fromValue(value), { transaction });
        } else {
          const currentValue = vCurrent.propertyValue(propertyName, { transaction });
          if (!(currentValue instanceof Vrapper)) {
            throw new Error(`Can't patch a complex object into non-resource-valued property '${
                propertyName}'`);
          }
          _patcher(currentValue, value);
        }
      });
    }
  }
}
