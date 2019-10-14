// @flow

import path from "path";
import fs from "fs";

import VALEK from "~/engine/VALEK";

import { dumpify, dumpObject, FabricEventTarget, outputError } from "~/tools";

import { _createMapper } from "./_mapperOps";
import {
  _createRouteRuntime, _preloadRuntimeResources, _buildRuntimeScope,
} from "./_routeRuntimeOps";
import { _buildKuery, _resolveSchemaName, _getResourceHRefPrefix } from "./_buildOps";
import { _filterResults, _sortResults, _paginateResults, _pickResultFields } from "./_resultOps";
import { _updateResource } from "./_updateOps";

const Fastify = require("fastify");

export default class MapperService extends FabricEventTarget {
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
    this._rootFastify = Fastify(options || {});
  }

  getRootFastify () { return this._rootFastify; }
  getEngine () { return this._engine; }
  getDiscourse () { return this._engine.discourse; }
  getViewFocus () { return this._view.getViewFocus(); }
  getSessionDuration () { return 86400 * 1.5; }

  async start () {
    const wrap = new Error(`start`);
    try {
      this._mappers = Object.entries(this._prefixes).map(([prefix, options]) => {
        const service = this;
        try {
          const mapper = _createMapper(this, prefix, options);
          this.getRootFastify().after(error => {
            if (error) {
              outputError(errorOnCreatePrefixPlugin(error),
                  "Exception caught during plugin register");
              throw error;
            }
          });
          return mapper;
        } catch (error) { throw errorOnCreatePrefixPlugin(error); }
        function errorOnCreatePrefixPlugin (error) {
          return service.wrapErrorEvent(error, new Error(
                `createPrefixPlugin(${options.openapi.info.name}@${options.openapi.info.version}:"${
                  prefix}")`),
            "\n\topenapi:", ...dumpObject(options.openapi),
            "\n\tswaggerPrefix:", options.swaggerPrefix,
            "\n\tschemas:", ...dumpObject(options.schemas),
            "\n\troutes:", ...dumpObject({ routes: options.routes }));
        }
      });
      this.getRootFastify().listen(this._port, this._address || undefined, (error) => {
        if (error) throw error;
        this.infoEvent(1, `listening @`, this.getRootFastify().server.address(),
            "exposing prefixes:",
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

  // Runtime ops

  _createRouteRuntime (options) {
    const wrap = new Error(
        `_createRouteRuntime(${options.category} ${options.method} ${options.fastifyRoute.url})`);
    const runtime = {};
    try {
      return _createRouteRuntime(this, options, runtime);
    } catch (error) {
      throw this.wrapErrorEvent(error, wrap,
          "\n\tfastifyRoute:", ...dumpObject(options.fastifyRoute),
          "\n\tbuiltinRules:", dumpify(options.builtinRules),
          "\n\trequiredRules:", dumpify(options.requiredRules),
          "\n\trequiredRuntimeRules:", dumpify(options.requiredRuntimeRules),
          "\n\tscopeBase:", dumpify(runtime.scopeBase, { indent: 2 }),
          "\n\trequestRules:", dumpify(runtime.requestRules, { indent: 2 }),
      );
    }
  }

  async preloadRuntimeResources (routeRuntime) {
    try {
      return await _preloadRuntimeResources(this, routeRuntime);
    } catch (error) {
      throw this.wrapErrorEvent(error, new Error(`preloadRuntimeResources(${
            routeRuntime.category} ${routeRuntime.method} ${routeRuntime.url})`),
          "\n\tfastifyRoute:", ...dumpObject(routeRuntime.fastifyRoute),
          "\n\tscopeBase:", dumpify(routeRuntime.scopeBase, { indent: 2 }),
          "\n\trequestRules:", dumpify(routeRuntime.requestRules, { indent: 2 }),
      );
    }
  }

  buildRuntimeScope (routeRuntime, request) {
    try {
      return _buildRuntimeScope(this, routeRuntime, request);
    } catch (error) {
      throw this.wrapErrorEvent(error, new Error(`buildRuntimeScope(${
            routeRuntime.category} ${routeRuntime.method} ${routeRuntime.url})`),
          "\n\tfastifyRoute:", ...dumpObject(routeRuntime.fastifyRoute),
          "\n\tscopeBase:", dumpify(routeRuntime.scopeBase, { indent: 2 }),
          "\n\trequestRules:", dumpify(routeRuntime.requestRules, { indent: 2 }),
      );
    }
  }

  // Build ops

  buildKuery (maybeJSONSchema, outerKuery, isValOSFields) {
    let innerKuery, jsonSchema;
    if (!maybeJSONSchema) return outerKuery;
    try {
      jsonSchema = _resolveSchemaName(this, maybeJSONSchema);
      innerKuery = this.addSchemaStep(jsonSchema, outerKuery);
      return _buildKuery(this, jsonSchema, outerKuery, innerKuery, isValOSFields);
    } catch (error) {
      throw this.wrapErrorEvent(error, new Error("buildKuery"),
          "\n\tjsonSchema:", ...dumpObject(jsonSchema),
          "\n\touterKuery:", ...dumpObject(outerKuery),
          "\n\tinnerKuery:", ...dumpObject(innerKuery));
    }
  }

  getResourceHRefPrefix (maybeJSONSchema: string | Object) {
    let jsonSchema;
    try {
      jsonSchema = _resolveSchemaName(this, maybeJSONSchema);
      return _getResourceHRefPrefix(this, jsonSchema);
    } catch (error) {
      throw this.wrapErrorEvent(error, new Error("getResourceHRefPrefix"),
          "\n\tjsonSchema:", dumpify(jsonSchema || maybeJSONSchema, { indent: 2 }));
    }
  }

  addSchemaStep (maybeJSONSchema, outerKuery) {
    const jsonSchema = _resolveSchemaName(this, maybeJSONSchema);
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

  // Result ops

  filterResults (...rest) {
    return _filterResults(this, ...rest);
  }

  sortResults (...rest) {
    return _sortResults(this, ...rest);
  }

  paginateResults (...rest) {
    return _paginateResults(this, ...rest);
  }

  pickResultFields (...rest) {
    return _pickResultFields(this, ...rest);
  }

  // Update resource ops

  updateResource (vResource, patch,
        options: { discourse: Object, scope: Object, toPatchTarget: Object } = {}) {
    return _updateResource(this, vResource, patch, options);
  }
}
