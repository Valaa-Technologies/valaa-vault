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
  getViewFocus () { return this._view.getViewFocus(); }

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
        if (swaggerPrefix) {
          fastify.register(FastifySwaggerPlugin, {
            routePrefix: swaggerPrefix,
            exposeRoute: true,
            swagger: openapi,
          });
        }
        prefixedThis.infoEvent(1, () => [`${prefix}: adding ${schemas.length} schemas`]);
        schemas.forEach(schema => fastify.addSchema(schema));
        prefixedThis.infoEvent(1, () => [
          `${prefix}: preparing ${routeHandlers.length} route handlers`,
        ]);
        await Promise.all(routeHandlers.map(routeHandler =>
            routeHandler.prepare && routeHandler.prepare(fastify)));
        prefixedThis.infoEvent(1, () => [
          `${prefix}: preloading ${routeHandlers.length} route handlers`,
        ]);
        await Promise.all(routeHandlers.map(routeHandler =>
            routeHandler.preload && routeHandler.preload()));
        prefixedThis.infoEvent(1, () => [
          `${prefix}: adding ${routeHandlers.length} fastify routes`,
        ]);
        routeHandlers.forEach(routeHandler =>
            fastify.route(routeHandler.fastifyRoute));
        prefixedThis.infoEvent(1, () => [
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
      prefixedThis._fastify.after(error => {
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

  prepareScopeRules ({ category, method, fastifyRoute, builtinRules, requiredRules }) {
    const wrap = new Error(`prepareScopeRules(${category} ${method} ${fastifyRoute.url})`);
    const ret = {
      scopeBase: { ...(fastifyRoute.config.scope || {}) },
      scopeRequestRules: [],
      requiredRules,
    };
    try {
      [...Object.entries(builtinRules || {}),
        ...Object.entries(fastifyRoute.config.scopeRules || {}),
        ...Object.entries(fastifyRoute.config.routeParams || {})
            .map(([k, v]) => ([k, ["params", v]])),
      ].forEach(([ruleName, [sectionName, sectionKey]]) => {
        if (sectionName === "constant") {
          ret.scopeBase[ruleName] = sectionKey;
        } else {
          ret.scopeRequestRules.push([ruleName, sectionName, sectionKey]);
        }
      });
      for (const requiredRuleName of requiredRules) {
        if ((ret.scopeBase[requiredRuleName] === undefined)
            && !ret.scopeRequestRules.find(([ruleName]) => (ruleName === requiredRuleName))) {
          throw new Error(`Required ${category} ${method} rule '${requiredRuleName}' is undefined`);
        }
      }
      _recurseFreeze(ret.scopeBase);
      return ret;
    } catch (error) {
      throw this.wrapErrorEvent(error, wrap,
          "\n\tfastifyRoute:", ...dumpObject(fastifyRoute),
          "\n\tbuiltinRules:", dumpify(builtinRules),
          "\n\trequiredRules:", dumpify(requiredRules),
          "\n\tscopeBase:", dumpify(ret.scopeBase, { indent: 2 }),
          "\n\tscopeRequestRules:", dumpify(ret.scopeRequestRules, { indent: 2 }),
      );
    }
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
    if (!sharedSchema) throw new Error(`Can't resolve shared schema "${maybeSchemaName}"`);
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
      return path.join("/",  this._prefix, routeName, "/");
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
          this._fastify.inject({
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
