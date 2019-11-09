// @flow

import path from "path";
import fs from "fs";

import { dumpify, dumpObject, FabricEventTarget, outputError } from "~/tools";

import { _createRouter } from "./_routerOps";
import {
  _createRouteRuntime, _preloadRuntimeResources, _buildRuntimeVALKOptions, _resolveRuntimeRules,
} from "./_routeRuntimeOps";
import { _appendSchemaSteps, _derefSchema, _getResourceHRefPrefix } from "./_buildOps";
import { _filterResults, _sortResults, _paginateResults, _pickResultFields } from "./_resultOps";
import { _updateResource } from "./_updateResourceOps";
import { _vakonpileVPath } from "./_vakonpileOps";

const Fastify = require("fastify");

export type PrefixRouter = MapperService;

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
          const mapper = _createPrefixService(this, prefix, options);
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

  createRouteRuntime (projector) {
    const runtime = {};
    try {
      return _createRouteRuntime(this, projector, runtime);
    } catch (error) {
      throw this.wrapErrorEvent(error,
          new Error(`createRouteRuntime(${this._projectorName(projector)})`),
          "\n\tconfig:", ...dumpObject(projector.config),
          "\n\tprojector:", ...dumpObject(projector),
          "\n\truntime:", ...dumpObject(runtime),
      );
    }
  }

  async preloadRuntimeResources (projector, runtime) {
    try {
      return await _preloadRuntimeResources(this, projector, runtime);
    } catch (error) {
      throw this.wrapErrorEvent(error,
          new Error(`preloadRuntimeResources(${this._projectorName(projector)})`),
          "\n\tconfig:", ...dumpObject(projector.config),
          "\n\tprojector:", ...dumpObject(projector),
          "\n\truntime:", ...dumpObject(runtime),
      );
    }
  }

  buildRuntimeVALKOptions (projector, runtime, request, reply) {
    try {
      return _buildRuntimeVALKOptions(this, projector, runtime, request, reply);
    } catch (error) {
      throw this.wrapErrorEvent(error,
          new Error(`buildRuntimeVALKOptions(${this._projectorName(projector)})`),
          "\n\tconfig:", ...dumpObject(projector.config),
          "\n\tprojector:", ...dumpObject(projector),
          "\n\truntime:", ...dumpObject(runtime),
      );
    }
  }

  resolveRuntimeRules (runtime, valkOptions) {
    try {
      return _resolveRuntimeRules(this, runtime, valkOptions);
    } catch (error) {
      throw this.wrapErrorEvent(error,
          new Error(`buildRuntimeVALKOptions()`),
          "\n\truntime:", ...dumpObject(runtime),
          "\n\tvalkOptions:", ...dumpObject(valkOptions),
      );
    }
  }

  _projectorName (projector) {
    return `${projector.method}-${projector.category} <${projector.url}>`;
  }

  // Build ops

  appendSchemaSteps (runtime, maybeJSONSchema,
      { expandProperties, isValOSFields, targetVAKON = ["§->"] } = {}) {
    let jsonSchema, innerTargetVAKON;
    if (!maybeJSONSchema) return targetVAKON;
    try {
      jsonSchema = this.derefSchema(maybeJSONSchema);
      innerTargetVAKON = this.appendVPathSteps(
          runtime, (jsonSchema.valospace || {}).reflection, targetVAKON);
      return _appendSchemaSteps(this, runtime, jsonSchema, targetVAKON,
          innerTargetVAKON, expandProperties, isValOSFields);
    } catch (error) {
      throw this.wrapErrorEvent(error, new Error("appendSchemaSteps"),
          "\n\truntime:", ...dumpObject(runtime),
          "\n\tjsonSchema:", ...dumpObject(jsonSchema),
          "\n\ttargetVAKON:", ...dumpObject(targetVAKON),
          "\n\tinnerTargetVAKON:", ...dumpObject(innerTargetVAKON),
        );
    }
  }

  appendVPathSteps (runtime, vpath, targetVAKON = ["§->"]) {
    let vpathVAKON, maybeInnerMapVAKON;
    try {
      if (vpath === undefined) return undefined;
      if (!vpath) return targetVAKON;
      vpathVAKON = _vakonpileVPath(vpath, runtime);
      targetVAKON.push(...vpathVAKON);
      maybeInnerMapVAKON = targetVAKON[targetVAKON.length - 1];
      return maybeInnerMapVAKON[0] === "§map"
          ? maybeInnerMapVAKON
          : targetVAKON;
    } catch (error) {
      throw this.wrapErrorEvent(error, new Error("appendSchemaSteps"),
          "\n\truntime:", ...dumpObject(runtime),
          "\n\tvpath:", ...dumpObject(vpath),
          "\n\ttargetVAKON:", ...dumpObject(targetVAKON),
          "\n\tvpathVAKON:", ...dumpObject(runtime),
          "\n\tmaybeInnerMapVAKON:", ...dumpObject(maybeInnerMapVAKON));
    }
  }

  getResourceHRefPrefix (maybeJSONSchema: string | Object) {
    let jsonSchema;
    try {
      jsonSchema = this.derefSchema(maybeJSONSchema);
      return _getResourceHRefPrefix(this, jsonSchema);
    } catch (error) {
      throw this.wrapErrorEvent(error, new Error("getResourceHRefPrefix"),
          "\n\tjsonSchema:", dumpify(jsonSchema || maybeJSONSchema, { indent: 2 }));
    }
  }

  derefSchema (maybeJSONSchemaOrName: string | Object) {
    return _derefSchema(this, maybeJSONSchemaOrName);
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
