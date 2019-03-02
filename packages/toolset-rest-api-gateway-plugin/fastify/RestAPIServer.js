// @flow

import path from "path";

import { asyncConnectToPartitionsIfMissingAndRetry } from "~/raem/tools/denormalized/partitions";
import { dumpify, dumpObject, LogEventGenerator, outputError } from "~/tools";
import VALEK from "~/engine/VALEK";
import Vrapper from "~/engine/Vrapper";

import * as handlers from "./handlers";

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
      this._prefixPlugins = Object.entries(this._prefixes).map(this._createPrefixPlugin);
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

  _createPrefixPlugin = ([prefix, {
    openapi, swaggerPrefix, schemas, routes, ...pluginOptions
  }]) => {
    const server = this;
    const wrap = new Error(
        `createPrefixPlugin(${openapi.info.name}@${openapi.info.version}:"${prefix}")`);
    try {
      const prefixedThis = Object.create(this);
      prefixedThis._prefix = prefix;
      // Create handlers for all routes before trying to register.
      // At this stage neither schema nor fastify is available for the
      // handlers.
      const routeHandlers = routes
          .map(route => prefixedThis._createRouteHandler(route))
          .filter(notFalsy => notFalsy);
      // https://github.com/fastify/fastify/blob/master/docs/Server.md
      prefixedThis._fastify.register(async (fastify, opts, next) => {
        try {
          if (swaggerPrefix) {
            fastify.register(FastifySwaggerPlugin, {
              routePrefix: swaggerPrefix,
              exposeRoute: true,
              swagger: openapi,
            });
          }
          schemas.forEach(schema => fastify.addSchema(schema));
          await Promise.all(routeHandlers.map(routeHandler =>
              routeHandler.prepare && routeHandler.prepare(fastify)));
          await Promise.all(routeHandlers.map(routeHandler =>
              routeHandler.preload && routeHandler.preload()));
          routeHandlers.forEach(routeHandler =>
              fastify.route(routeHandler.fastifyRoute));
          fastify.ready(err => {
            if (err) throw err;
            fastify.swagger();
          });
        } catch (error) {
          const wrapped = errorOnCreatePrefixPlugin(error);
          outputError(wrapped, "Exception caught during plugin register");
          throw wrapped;
        } finally {
          next(); // Always install other plugins
        }
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

  _createRouteHandler (route) {
    const wrap = new Error(`createRouteHandler(${route.category || "<categoryless>"} ${
        route.method} ${route.url})`);
    try {
      if (!route.category) throw new Error(`Route category undefined`);
      if (!route.method) throw new Error(`Route method undefined`);
      if (!route.url) throw new Error(`Route url undefined`);
      const createRouteHandler = (handlers[route.category] || {})[route.method];
      if (!createRouteHandler) {
        throw new Error(`No route handler creators found for '${route.category} ${route.method}'`);
      }
      const routeHandler = createRouteHandler(this, route);
      if (!routeHandler) return undefined;
      if (!routeHandler.name) routeHandler.name = `${route.category} ${route.method} ${route.url}`;
      const routeErrorMessage = `Exception caught during: ${routeHandler.name}`;
      route.handler = asyncConnectToPartitionsIfMissingAndRetry(
          (request, reply) => {
            const result = routeHandler.handleRequest(request, reply);
            if (result === undefined) {
              this.errorEvent("ERROR: got undefined return value from route:", routeHandler.name,
                  "\n\texpected true, false or promise (so that exceptions are properly caught)",
                  "\n\trequest.query:", ...dumpObject(request.query),
                  "\n\trequest.body:", ...dumpObject(request.body));
            }
            return result;
          },
          (error, request, reply) => {
            reply.code(500);
            reply.send(error.message);
            outputError(this.wrapErrorEvent(error, new Error(`${routeHandler.name}`),
                "\n\trequest.params:", ...dumpObject(request.params),
                "\n\trequest.query:", ...dumpObject(request.query),
                "\n\trequest.body:", ...dumpObject(request.body),
            ), routeErrorMessage, this.getLogger());
          },
      );
      return routeHandler;
    } catch (error) {
      throw this.wrapErrorEvent(error, wrap, "\n\troute:", dumpify(route, { indent: 2 }));
    }
  }

  prepareScopeRules ({ category, method, route, builtinScopeRules, requiredRules }) {
    const ret = {
      scopeBase: { ...(route.config.scope || {}) },
      scopeRequestRules: [],
      requiredRules,
    };
    [...Object.entries(builtinScopeRules),
      ...Object.entries(route.config.rules),
      ...Object.entries(route.config.routeParams).map(([k, v]) => ([k, ["params", v]])),
    ].forEach(([ruleName, [sectionName, sectionKey]]) => {
      if (sectionName === "constant") {
        ret.scopeBase[ruleName] = sectionKey;
      } else {
        ret.scopeRequestRules.push([ruleName, sectionName, sectionKey]);
      }
    });
    for (const requiredFieldName of requiredRules) {
      if ((ret.scopeBase[requiredFieldName] === undefined)
          && !ret.scopeRules.find(([scopeFieldName]) => (scopeFieldName === requiredFieldName))) {
        throw new Error(`Required ${category} ${method} rule '${requiredFieldName}' is undefined`);
      }
    }
    _recurseFreeze(ret.scopeBase);
    return ret;
    function _recurseFreeze (value) {
      if (!value || (typeof value !== "object")) return;
      Object.values(value).forEach(_recurseFreeze);
      Object.freeze(value);
    }
  }

  buildRequestScope (request, { scopeBase, scopeRequestRules, requiredRules }) {
    const scope = Object.create(scopeBase);
    scope.request = request;
    for (const [ruleName, requestSection, sectionKey] of scopeRequestRules) {
      scope[ruleName] = request[requestSection][sectionKey];
    }
    for (const ruleName of requiredRules) {
      if (scope[ruleName] === undefined) {
        throw new Error(`scope rule '${ruleName}' resolved into undefined`);
      }
    }
    return scope;
  }

  buildKuery (jsonSchema, outerKuery, isValOSFields) {
    let innerKuery;
    try {
      if (!jsonSchema) return outerKuery;
      if (typeof jsonSchema === "string") {
        if (jsonSchema[(jsonSchema.length || 1) - 1] !== "#") {
          throw new Error(
              `String without '#' suffix is not a valid shared schema name: "${jsonSchema}"`);
        }
        const sharedSchema = this._fastify.getSchemas()[jsonSchema.slice(0, -1)];
        if (!sharedSchema) throw new Error(`Can't resolve shared schema "${jsonSchema}"`);
        return this.buildKuery(sharedSchema, outerKuery, isValOSFields);
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
        this.buildKuery(jsonSchema.items, innerKuery);
      } else if (jsonSchema.type === "object") {
        const objectKuery = {};
        Object.entries(jsonSchema.properties).forEach(([key, valueSchema]) => {
          let op;
          if (isValOSFields && ((valueSchema.valos || {}).predicate === undefined)) {
            if (key === "href") {
              op = ["§->", "target", false, "rawId",
                ["§+", this.getResourceHRefPrefix(jsonSchema), ["§->", null]]
              ];
            } else if (key === "rel") op = "self";
            else op = ["§->", key];
          } else if (key === "$V") {
            this.buildKuery(valueSchema, (op = ["§->"]), true);
          } else {
            this.buildKuery(valueSchema, (op = ["§->"]));
            op = (op.length === 1) ? ["§..", key]
                : ((valueSchema.type === "array")
                    || (valueSchema.valos || {}).predicate !== undefined) ? op
                : ["§->", ["§..", key], false, ...op.slice(1)];
          }
          objectKuery[key] = op;
        });
        (innerKuery || outerKuery).push(objectKuery);
      }
      return outerKuery;
    } catch (error) {
      throw this.wrapErrorEvent(error, new Error("buildKuery"),
          "\n\tjsonSchema:", ...dumpObject(jsonSchema),
          "\n\touterKuery:", ...dumpObject(outerKuery),
          "\n\tinnerKuery:", ...dumpObject(innerKuery));
    }
  }

  getResourceHRefPrefix (jsonSchema) {
    if (!(jsonSchema.valos.route || {}).name) {
      throw new Error("href requested without json schema valos route.name");
    }
    return path.join("/",  this._prefix, jsonSchema.valos.route.name, "/");
  }

  _extractValOSSchemaKuery (valosSchema, outerKuery) {
    const predicate = (valosSchema || {}).predicate;
    if (predicate === undefined) return undefined;
    if (predicate === "") return outerKuery;
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

  _pickResultFields (result, fields) {
    const fieldNames = fields.split(",");
    return !Array.isArray(result) ? _pickFields(result) : result.map(_pickFields);
    function _pickFields (entry) {
      const ret = {};
      for (const name of fieldNames) {
        const value = entry[name];
        if (value !== undefined) ret[name] = value;
      }
      return ret;
    }
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

  patchResource (vResource, patch, { transaction, scope, toPatchTarget } = {}) {
    const vTarget = !toPatchTarget ? vResource
        : vResource.get(toPatchTarget, { transaction, scope });
    _patcher(vTarget, patch);
    return vTarget;
    function _patcher (vScope, subpatch) {
      Object.entries(subpatch).forEach(([propertyName, value]) => {
        if ((value === undefined) || (propertyName === "$V")) return;
        if (!value || (typeof value !== "object")) {
          vScope.alterProperty(propertyName, VALEK.fromValue(value), { transaction, scope });
        } else {
          const currentValue = vScope.propertyValue(propertyName, { transaction, scope });
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
