// @flow

import path from "path";
import fs from "fs";

import { asyncConnectToPartitionsIfMissingAndRetry } from "~/raem/tools/denormalized/partitions";
import VALEK from "~/engine/VALEK";
import Vrapper from "~/engine/Vrapper";

import {
  patchWith, dumpify, dumpObject, FabricEventTarget, outputError, thenChainEagerly,
} from "~/tools";

import * as handlers from "./handlers";

const Fastify = require("fastify");
const FastifySwaggerPlugin = require("fastify-swagger");
const FastifyCookiePlugin = require("fastify-cookie");

export default class RestAPIService extends FabricEventTarget {
  constructor ({ view, viewName, port, address, fastify, prefixes, ...rest }) {
    super(rest.name, rest.verbosity, view._gateway.getLogger());
    this._view = view;
    this._viewName = viewName;
    this._engine  = view.engine;
    this._gateway = view._gateway;

    this._port = port;
    this._address = address;
    this._prefixes = prefixes;
    const options = { ...fastify };
    if (options.https) {
      options.https = {
        ...options.https,
        key: fs.readFileSync(path.join(process.cwd(), options.https.key), "utf8"),
        cert: fs.readFileSync(path.join(process.cwd(), options.https.cert), "utf8"),
      };
    }
    this._rootify = Fastify(options || {});
  }

  getEngine () { return this._engine; }
  getDiscourse () { return this._engine.discourse; }
  getViewFocus () { return this._view.getViewFocus(); }
  getSessionDuration () { return 86400 * 1.5; }

  async start () {
    const wrap = new Error(`start`);
    try {
      this._prefixPlugins = Object.entries(this._prefixes).map(this._createPrefixPlugin);
      this._rootify.listen(this._port, this._address || undefined, (error) => {
        if (error) throw error;
        this.infoEvent(1, `listening @`, this._rootify.server.address(), "exposing prefixes:",
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
    openapi, swaggerPrefix, schemas, routes, identity, sessionDuration, ...pluginOptions,
  }]) => {
    const server = this;
    try {
      const prefixServer = Object.create(this);
      prefixServer.getRoutePrefix = () => prefix;
      prefixServer.getSessionDuration = () => (sessionDuration || this.getSessionDuration());
      prefixServer.getIdentity = () => identity;

      // Create handlers for all routes before trying to register.
      // At this stage neither schema nor fastify is available for the
      // handlers.
      const routeHandlers = routes
          .map(route => prefixServer._createRouteHandler(route))
          .filter(notFalsy => notFalsy);
      // https://github.com/fastify/fastify/blob/master/docs/Server.md
      prefixServer._rootify.register(async (fastify, opts, next) => {
        prefixServer._fastify = fastify;
        fastify.register(FastifyCookiePlugin);
        if (swaggerPrefix) {
          fastify.register(FastifySwaggerPlugin, {
            routePrefix: swaggerPrefix,
            exposeRoute: true,
            swagger: openapi,
          });
        }
        prefixServer.infoEvent(1, () => [
          `${prefix}: adding ${schemas.length} schemas:`,
          ...schemas.map(schema => schema.schemaName),
        ]);
        schemas.forEach(schema => fastify.addSchema(schema));
        prefixServer.infoEvent(1, () => [
          `${prefix}: preparing ${routeHandlers.length} route handlers`,
        ]);
        await Promise.all(routeHandlers.map(routeHandler =>
            routeHandler.prepare && routeHandler.prepare(fastify)));
        prefixServer.infoEvent(1, () => [
          `${prefix}: preloading ${routeHandlers.length} route handlers`,
        ]);
        await Promise.all(routeHandlers.map(routeHandler =>
            routeHandler.preload && routeHandler.preload()));
        prefixServer.infoEvent(1, () => [
          `${prefix}: adding ${routeHandlers.length} fastify routes`,
        ]);
        routeHandlers.forEach(routeHandler =>
            fastify.route(routeHandler.fastifyRoute));
        prefixServer.infoEvent(1, () => [
          `${prefix}: plugin ready`,
        ]);
        fastify.ready(err => {
          if (err) throw err;
          fastify.swagger();
        });
        next(); // Always install other plugins
      }, {
        prefix,
        ...pluginOptions,
      });
      prefixServer._rootify.after(error => {
        if (error) {
          outputError(errorOnCreatePrefixPlugin(error), "Exception caught during plugin register");
          throw error;
        }
      });
    } catch (error) { throw errorOnCreatePrefixPlugin(error); }
    function errorOnCreatePrefixPlugin (error) {
      return server.wrapErrorEvent(error, new Error(
            `createPrefixPlugin(${openapi.info.name}@${openapi.info.version}:"${prefix}")`),
        "\n\topenapi:", ...dumpObject(openapi),
        "\n\tswaggerPrefix:", swaggerPrefix,
        "\n\tschemas:", ...dumpObject(schemas),
        "\n\troutes:", ...dumpObject({ routes }));
    }
  }

  _createRouteHandler (route) {
    const wrap = new Error(`createRouteHandler(${route.category || "<categoryless>"} ${
        route.method} ${route.url})`);
    try {
      if (!route.category) throw new Error(`Route category undefined`);
      if (!route.method) throw new Error(`Route method undefined`);
      if (!route.url) throw new Error(`Route url undefined`);
      if (!route.config) throw new Error(`Route config undefined`);
      const createRouteHandler = (handlers[route.category] || {})[route.method];
      if (!createRouteHandler) {
        throw new Error(`No route handler creators found for '${route.category} ${route.method}'`);
      }
      const routeHandler = createRouteHandler(this, route);
      if (!routeHandler) return undefined;
      if (!routeHandler.name) routeHandler.name = `${route.category} ${route.method} ${route.url}`;
      const routeErrorMessage = `Exception caught during: ${routeHandler.name}`;
      const handle = asyncConnectToPartitionsIfMissingAndRetry(
          (request, reply) => thenChainEagerly(
              routeHandler.handleRequest(request, reply),
              result => {
                if (result !== true) {
                  throw this.wrapErrorEvent(
                      new Error("INTERNAL SERVER ERROR: invalid route handler return value"),
                      new Error(`handleRequest return value validator`),
                      "\n\treturn value:", ...dumpObject(result),
                      "Note: routeHandler.handleRequest must explicitly call reply.code/send",
                      "and return true or return a Promise which resolves to true.",
                      "This ensures that exceptions are always caught and logged properly");
                }
              }),
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
      route.handler = (request, reply) => { handle(request, reply); };
      return routeHandler;
    } catch (error) {
      throw this.wrapErrorEvent(error, wrap, "\n\troute:", dumpify(route, { indent: 2 }));
    }
  }

  prepareRuntime ({
    category, method, fastifyRoute, builtinRules, requiredRules, requiredRuntimeRules,
  }) {
    const wrap = new Error(`prepareRuntime(${category} ${method} ${fastifyRoute.url})`);
    let ret;
    try {
      ret = {
        scopeBase: { ...(fastifyRoute.config.staticRules || {}) },
        requestRules: [],
        // kueryRules: [],
        requiredRuntimeRules: requiredRuntimeRules || [],
      };
      [..._entriesOf(builtinRules || {}),
        ..._entriesOf(fastifyRoute.config.constantRules || {})
            .map(([k, v]) => ([k, ["constant", v]])),
        ..._entriesOf(fastifyRoute.config.routeRules || {})
            .map(([k, v]) => ([k, ["params", v]])),
        ..._entriesOf(fastifyRoute.config.queryRules || {})
            .map(([k, v]) => ([k, ["query", v]])),
        ..._entriesOf(fastifyRoute.config.cookieRules || {})
            .map(([k, v]) => ([k, ["cookies", v]])),
      ].forEach(([ruleName, [sourceSection, source]]) => {
        if (source === undefined) return;
        if (sourceSection === "constant") {
          ret.scopeBase[ruleName] = source;
        } else {
          ret.requestRules.push([ruleName, sourceSection, source]);
        }
      });
      // ret.kueryRules.push(..._entriesOf(fastifyRoute.config.kueryRules));
      for (const requiredRuleName of [...(requiredRules || []), ...(requiredRuntimeRules || [])]) {
        if ((ret.scopeBase[requiredRuleName] === undefined)
            && !ret.requestRules.find(([ruleName]) => (ruleName === requiredRuleName))
            // && !ret.kueryRules.find(([ruleName]) => (ruleName === requiredRuleName)
            ) {
          throw new Error(`Required ${category} ${method} rule '${requiredRuleName}' is undefined`);
        }
      }
      return ret;
    } catch (error) {
      throw this.wrapErrorEvent(error, wrap,
          "\n\tfastifyRoute:", ...dumpObject(fastifyRoute),
          "\n\tbuiltinRules:", dumpify(builtinRules),
          "\n\trequiredRules:", dumpify(requiredRules),
          "\n\trequiredRuntimeRules:", dumpify(requiredRuntimeRules),
          "\n\tscopeBase:", dumpify(ret && ret.scopeBase, { indent: 2 }),
          "\n\trequestRules:", dumpify(ret && ret.requestRules, { indent: 2 }),
          // "\n\tkueryRules:", dumpify(ret.kueryRules, { indent: 2 }),
      );
    }
    function _entriesOf (object) {
      return Array.isArray(object) ? object : Object.entries(object);
    }
  }

  buildScope (request, options: {
    scopeBase: Object, requiredRuntimeRules: string[],
    requestRules: Object[],
  }) {
    const scope = Object.create(options.scopeBase);
    scope.request = request;
    for (const [ruleName, sourceSection, source] of options.requestRules) {
      scope[ruleName] = request[sourceSection][source];
    }
    // for (const [ruleName, rule] of options.kueryRules) {}
    for (const ruleName of options.requiredRuntimeRules) {
      if (scope[ruleName] === undefined) {
        throw new Error(`scope rule '${ruleName}' resolved into undefined`);
      }
    }
    return scope;
  }

  buildKuery (jsonSchema_, outerKuery, isValOSFields) {
    let innerKuery, jsonSchema;
    if (!jsonSchema_) return outerKuery;
    try {
      jsonSchema = this._resolveSchemaName(jsonSchema_);
      innerKuery = this.addSchemaStep(jsonSchema, outerKuery);
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

  _resolveSchemaName (maybeSchemaName) {
    if (typeof maybeSchemaName !== "string") return maybeSchemaName;
    if (maybeSchemaName[(maybeSchemaName.length || 1) - 1] !== "#") {
      throw new Error(
          `String without '#' suffix is not a valid shared schema name: "${maybeSchemaName}"`);
    }
    const sharedSchema = this._fastify.getSchemas()[maybeSchemaName.slice(0, -1)];
    if (!sharedSchema) {
      throw new Error(`Can't resolve shared schema "${maybeSchemaName}"`);
    }
    return sharedSchema;
  }

  getResourceHRefPrefix (jsonSchema_) {
    let jsonSchema;
    try {
      jsonSchema = this._resolveSchemaName(jsonSchema_);
      const routeName = ((jsonSchema.valos || {}).route || {}).name;
      if (typeof routeName !== "string") {
        throw new Error("href requested without json schema valos route.name");
      }
      return path.join("/",  this.getRoutePrefix(), routeName, "/");
    } catch (error) {
      throw this.wrapErrorEvent(error, new Error("getResourceHRefPrefix"),
          "\n\tjsonSchema:", dumpify(jsonSchema || jsonSchema_, { indent: 2 }));
    }
  }

  addSchemaStep (jsonSchema_, outerKuery) {
    const jsonSchema = this._resolveSchemaName(jsonSchema_);
    const predicate = (jsonSchema.valos || {}).predicate;
    if (predicate === undefined) return undefined;
    if (predicate === "") return outerKuery;
    return predicate.split("!").reduce((innerKuery, part) => {
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
      throw new Error(`Unrecognized part <${part}> in valos predicate <${
          jsonSchema.valos.predicate}>`);
    }, outerKuery);
  }

  _pickResultFields (rootResult, fields /* , resultSchema */) {
    const FieldSchema = Symbol("FieldSchema");
    const selectors = { [FieldSchema]: false };
    fields.split(",").forEach(field => {
      const steps = field.split("/");
      const isInject = steps[steps.length - 1] === "*";
      if (isInject) steps.splice(-1);
      const fieldSelector = steps.reduce(
          (nesting, step) => nesting[step] || (nesting[step] = { [FieldSchema]: false }),
          selectors,
      );
      fieldSelector[FieldSchema] = !isInject ? true
          : {}; /* : steps.reduce((subSchema, step, index) => {
        let returning;
        for (let current = subSchema; ;) {
          if (typeof current === "string") current = this._resolveSchemaName(current);
          else if (current.type === "array") current = current.items;
          else if (returning) return current;
          else if (current.type !== "object") {
            throw new Error(`Can't access field '${step}' (fields JSON pointer ${
              JSON.stringify(field)} step #${index}) from non-object schema ${current.type}`);
          } else {
            current = current.properties[step];
            if (!current) {
              throw new Error(`Can't find field '${step}' (fields JSON pointer ${
                  JSON.stringify(field)} step #${index}) from object schema properties`);
            }
            returning = true;
          }
        }
      }, resultSchema);
      */
    });
    const injects = [];
    const _pickFields = (result, selector) => {
      if (!result || (typeof result !== "object")) return;
      if (Array.isArray(result)) {
        for (const entry of result) _pickFields(entry, selector);
        return;
      }
      const fieldSchema = selector[FieldSchema];
      const V = result.$V;
      for (const [key, value] of Object.entries(result)) {
        const subSelector = selector[key];
        if (subSelector) _pickFields(value, subSelector);
        else if ((fieldSchema === false) && (key !== "$V")) delete result[key];
      }
      if (((V || {}).rel === "self")
          && ((fieldSchema && (fieldSchema !== true)) || Object.keys(selector).length)) {
        // So this is not exactly kosher. To implement expansion of
        // nested properties we make virtual GET requests using the
        // injection API which is primarily intended for testing and
        // incurs full request overheads for each call. On the other
        // hand, this is simple, complete and way more efficient than
        // having clients make separate queries for the entries.
        const subFields = _gatherSubFields(selector).join(",");
        injects.push(
          this._rootify.inject({
            method: "GET",
            url: V.href,
            query: { fields: subFields },
          }).then(response => {
            if (response.statusCode === 200) {
              V.target = JSON.parse(response.payload);
            } else {
              V.expansion = { statusCode: response.statusCode, payload: response.payload };
            }
            result.$V = V;
          }).catch(error => {
            V.expansion = { statusCode: 500, payload: error.message };
            result.$V = V;
          }),
        );
      }
    };
    _pickFields(rootResult, selectors);
    if (!injects.length) return rootResult;
    return Promise.all(injects).then(() => rootResult);
    function _gatherSubFields (selector, currentPath = "", subFields = []) {
      if (selector[FieldSchema]) {
        subFields.push((selector[FieldSchema] === true) ? currentPath
            : !currentPath ? "*"
            : `${currentPath}/*`);
      }
      Object.entries(selector).forEach(([key, subSelector]) =>
          _gatherSubFields(subSelector, `${currentPath ? `${currentPath}/` : ""}${key}`,
              subFields));
      return subFields;
    }
  }

  async preloadRuntime (routeRuntime) {
    const activations =  [];
    routeRuntime.scopeBase = patchWith({}, routeRuntime.scopeBase, {
      preExtend: (tgt, patch) => {
        if (!Array.isArray(patch) || (patch[0] !== "~ref")) return undefined;
        const vResource = this.getEngine().getVrapper(patch[1]);
        const activation = vResource.activate();
        if (activation) activations.push(activation);
        return vResource;
      },
      postExtend: (tgt) => {
        if (tgt && (typeof tgt === "object") && !(tgt instanceof Vrapper)) Object.freeze(tgt);
        return tgt;
      },
    });
    await Promise.all(activations);
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

  patchResource (vResource, patch, { discourse, scope, toPatchTarget } = {}) {
    if (!vResource) {
      if (!toPatchTarget) return undefined;
      throw new Error("Target resource missing when trying to PATCH fields");
    }
    const vTarget = !toPatchTarget ? vResource
        : vResource.get(toPatchTarget, { discourse, scope });
    _patcher(vTarget, patch);
    return vTarget;
    function _patcher (vScope, subpatch) {
      Object.entries(subpatch).forEach(([propertyName, value]) => {
        if ((value === undefined) || (propertyName === "$V")) return;
        if (Array.isArray(value)) throw new Error("Batch mapping PATCH not implemented yet");
        const currentValue = vScope.propertyValue(propertyName, { discourse, scope });
        if (currentValue instanceof Vrapper) {
          if ((value == null) || (typeof value !== "object")) {
            throw new Error(`Cannot overwrite a structured property '${propertyName
                }' with a non-object value of type '${typeof value}'`);
          }
          _patcher(currentValue, value);
        } else {
          const newValue = ((value != null) && (typeof value === "object")
                  && (currentValue != null) && (typeof currentValue === "object"))
              ? Object.assign(currentValue, value)
              : value;
          vScope.alterProperty(propertyName, VALEK.fromValue(newValue), { discourse, scope });
        }
      });
    }
  }
}
