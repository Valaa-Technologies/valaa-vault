// @flow

import path from "path";
import fs from "fs";

import { extendVAKON } from "~/raem/VPath";
import { dumpify, dumpObject, FabricEventTarget, outputError } from "~/tools";

import { _createPrefixRouter, _projectPrefixRoutesFromView } from "./_routerOps";
import {
  _createProjectorRuntime, _preloadRuntimeResources, _buildRuntimeVALKOptions, _resolveToScope,
} from "./_projectorOps";
import { _appendSchemaSteps, _derefSchema } from "./_buildOps";
import { _getIdentityRoles } from "./_identityOps";
import {
  _filterResults, _sortResults, _paginateResults, _pickResultFields, _fillReplyFromResponse,
} from "./_resultOps";
import { _addResourceProjector, _createGetRelSelfHRef, _relRequest } from "./_relOps";
import { _updateResource } from "./_updateResourceOps";
import { _vakonpileVPath } from "./_vakonpileOps";

const Fastify = require("fastify");

export type PrefixRouter = MapperService;

export default class MapperService extends FabricEventTarget {
  constructor (gateway, { identity, port, address, fastify, ...rest }, projectorCreators) {
    super(gateway, rest.verbosity, rest.name);

    this._identity = identity;
    this._rolesByIdentity = {};
    this._port = port;
    this._address = address;
    this._projectorCreators = projectorCreators;

    const options = { ...fastify };
    if (options.https) {
      options.https = {
        ...options.https,
        key: fs.readFileSync(path.join(process.cwd(), options.https.key), "utf8"),
        cert: fs.readFileSync(path.join(process.cwd(), options.https.cert), "utf8"),
      };
    }
    this._rootFastify = Fastify(options || {});
    this._prefixRouters = {};
  }

  getGateway () { return this._parent; }

  getRootFastify () { return this._rootFastify; }

  createPrefixRouter (prefix, prefixConfig) {
    const service = this;
    const openapi = prefixConfig.openapi || { info: { name: "<missing>", version: "<missing>" } };
    try {
      if (this._prefixRouters[prefix]) {
        throw new Error(`Prefix router already exists for: <${prefix}>`);
      }
      if (!prefixConfig.openapi) {
        throw new Error(`Prefix config openapi section missing for prefix: <${prefix}>`);
      }
      this.clockEvent(1, () => [
        `restAPISpindle.prefixRouter.create`,
        `Creating prefix router for: ${prefix}`,
      ]);
      // console.log("prefix:", prefix, "\n\tconfig:", prefixConfig);
      const router = this._prefixRouters[prefix] = _createPrefixRouter(this, prefix, prefixConfig);
      this.getRootFastify().after(error => {
        if (error) {
          outputError(errorOnCreatePrefixRouter(error),
              "Exception intercepted during router register");
          throw error;
        }
      });
      return router;
    } catch (error) {
      throw errorOnCreatePrefixRouter(error);
    }
    function errorOnCreatePrefixRouter (error) {
      return service.wrapErrorEvent(error, 1,
        new Error(`createPrefixRouter(${openapi.info.name}@${openapi.info.version}: <${prefix}>)`),
        "\n\tprefixConfig:", ...dumpObject(prefixConfig),
        "\n\tswaggerPrefix:", prefixConfig.swaggerPrefix,
        "\n\tschemas:", ...dumpObject(prefixConfig.schemas),
        "\n\troutes:", ...dumpObject({ routes: prefixConfig.routes }));
    }
  }

  start () {
    const wrap = new Error(`start()`);
    try {
      this.getRootFastify().listen(this._port, this._address || undefined,
          (error) => {
            if (error) throw error;
            this.infoEvent(1, `listening @`, this.getRootFastify().server.address(),
                "prepared prefixes:",
                ...[].concat(...Object.entries(this._prefixRouters).map(
                    ([prefix, { _config: { openapi: { info: { name, title, version } } } }]) =>
                        [`\n\t${prefix}:`, `${name}@${version} -`, title]
                )));
          });
    } catch (error) {
      throw this.wrapErrorEvent(error, 1, wrap,
          "\n\trouters:", ...dumpObject(this._prefixRouters));
    }
  }

  async stop () {
    try {
      return await this.getRootFastify().close();
    } catch (error) {
      throw this.wrapErrorEvent(error, 1, new Error("stop()"),
          "\n\trouters:", ...dumpObject(this._prefixRouters));
    }
  }

  // PrefixRouter methods

  getEngine () { return this._engine; }
  getDiscourse () { return this._engine.discourse; }
  getViewFocus () { return this._view.getFocus(); }
  getViewScope () { return this._engine.getLexicalScope(); }
  getSessionDuration () { return 86400 * 1.5; }

  isSessionAuthorizationEnabled () { return this._isSessionAuthorizationEnabled; }
  setSessionAuthorizationEnabled (value = true) { this._isSessionAuthorizationEnabled = value; }

  async projectFromView (view, viewName) {
    try {
      return await _projectPrefixRoutesFromView(this, view, viewName);
    } catch (error) {
      throw this.wrapErrorEvent(error, 1, new Error(`projectFromView(${viewName})`),
          "\n\tview:", ...dumpObject(view),
          "\n\trouters:", ...dumpObject(this._prefixRouters));
    }
  }

  createRouteProjector (route) {
    const wrap = new Error(`createRouteProjector(${this._routeName(route)})`);
    try {
      if (!route.url) throw new Error(`Route url undefined`);
      if (!route.category) throw new Error(`Route category undefined`);
      if (!route.method) throw new Error(`Route method undefined`);
      if (!route.config) throw new Error(`Route config undefined`);
      const createProjector = (this._projectorCreators[route.category] || {})[route.method];
      if (!createProjector) {
        throw new Error(`No projector found for '${route.category} ${route.method}'`);
      }
      route.params = [];
      route.parts = route.url.split("/").slice(1).map(part => {
        if (part[0] !== ":") return part;
        route.params.push(part.slice(1));
        return route.params.length - 1;
      });
      const projector = createProjector(this, route);
      if (projector == null) return undefined;
      if (!projector.name) projector.name = this._routeName(route);
      projector.route = route;
      projector.config = route.config;
      return projector;
    } catch (error) {
      throw this.wrapErrorEvent(error, 1, wrap,
          "\n\troute:", ...dumpObject(route));
    }
  }

  // Runtime ops

  createProjectorRuntime (projector, route) {
    const runtime = {};
    try {
      return _createProjectorRuntime(this, projector, route, runtime);
    } catch (error) {
      throw this.wrapErrorEvent(error, 1,
          new Error(`createProjectorRuntime(${this._projectorName(projector)})`),
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
      throw this.wrapErrorEvent(error, 1,
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
      throw this.wrapErrorEvent(error, 1,
          new Error(`buildRuntimeVALKOptions(${this._projectorName(projector)})`),
          "\n\tconfig:", ...dumpObject(projector.config),
          "\n\tprojector:", ...dumpObject(projector),
          "\n\truntime:", ...dumpObject(runtime),
      );
    }
  }

  presolveRulesToScope (runtime, valkOptions) {
    for (const [ruleName, resolveRule, requiredAtRuntime] of runtime.rulePresolvers) {
      try {
        if (!_resolveToScope(this, valkOptions.scope.routeRoot, valkOptions,
            ruleName, resolveRule, requiredAtRuntime)) {
          return true; // Failure.
        }
      } catch (error) {
        throw this.wrapErrorEvent(error, 1,
            new Error(`presolveRulesToScope(rulwrapErrorEventeName: '${ruleName}')`),
            "\n\tresolveRule:", ...dumpObject(resolveRule),
            "\n\truntime:", ...dumpObject(runtime),
            "\n\tvalkOptions:", ...dumpObject(valkOptions),
        );
      }
    }
    return false; // Success.
  }

  resolveToScope (scopeKey, [resolveRule, requiredAtRuntime], resolveHead, valkOptions) {
    try {
      if (!_resolveToScope(
          this, resolveHead, valkOptions, scopeKey, resolveRule, requiredAtRuntime)) {
        throw new Error(`Runtime failure when resolving scope key '${scopeKey}'`);
      }
      return valkOptions.scope[scopeKey];
    } catch (error) {
      throw this.wrapErrorEvent(error, 1,
          new Error(`resolveToScope('${scopeKey}')`),
          "\n\tvalkOptions:", ...dumpObject(valkOptions),
          "\n\tresolveHead:", ...dumpObject(resolveHead || valkOptions.scope.routeRoot),
      );
    }
  }

  _projectorName (projector) {
    return projector.name || this._routeName(projector.route);
  }

  _routeName (route) {
    return `${route.method}-${route.category} <${route.url}>`;
  }

  // Build ops

  derefSchema (maybeJSONSchemaOrName: string | Object) {
    return _derefSchema(this, maybeJSONSchemaOrName);
  }

  appendSchemaSteps (runtime, maybeJSONSchema, {
    expandProperties, isValOSFields, targetVAKON = ["§->"], entryTargetVAKON,
  } = {}) {
    let schema, innerTargetVAKON;
    if (!maybeJSONSchema) return targetVAKON || entryTargetVAKON;
    try {
      schema = this.derefSchema(maybeJSONSchema);
      innerTargetVAKON = entryTargetVAKON
          || this.appendVPathSteps(runtime, (schema.valospace || {}).reflection, targetVAKON);
      if (!innerTargetVAKON) {
        if (schema.type !== "array") innerTargetVAKON = targetVAKON;
        else targetVAKON.push((innerTargetVAKON = ["§map"]));
      }
      _appendSchemaSteps(this, runtime, schema, innerTargetVAKON, expandProperties, isValOSFields);
      return targetVAKON;
    } catch (error) {
      throw this.wrapErrorEvent(error, 1, new Error("appendSchemaSteps"),
          "\n\truntime:", ...dumpObject(runtime),
          "\n\tschema:", dumpify(schema),
          "\n\ttargetVAKON:", ...dumpObject(targetVAKON),
          "\n\tinnerTargetVAKON:", ...dumpObject(innerTargetVAKON),
        );
    }
  }

  appendVPathSteps (runtime, vpath, targetVAKON = ["§->"]) {
    let vpathVAKON, maybeInnerPluralMapVAKON;
    try {
      if (vpath === undefined) return undefined;
      if (!vpath) return targetVAKON;
      vpathVAKON = _vakonpileVPath(vpath, runtime);
      extendVAKON(targetVAKON, vpathVAKON);
      if (Array.isArray(vpathVAKON)) {
        maybeInnerPluralMapVAKON = vpathVAKON[vpathVAKON.length - 1];
        if (maybeInnerPluralMapVAKON[0] === "§map") return maybeInnerPluralMapVAKON;
      }
      return targetVAKON;
    } catch (error) {
      throw this.wrapErrorEvent(error, 1, new Error("appendSchemaSteps"),
          "\n\truntime:", ...dumpObject(runtime),
          "\n\tvpath:", ...dumpObject(vpath),
          "\n\ttargetVAKON:", ...dumpObject(targetVAKON),
          "\n\tvpathVAKON:", ...dumpObject(runtime),
          "\n\tmaybeInnerPluralMapVAKON:", ...dumpObject(maybeInnerPluralMapVAKON));
    }
  }

  appendGateProjectionSteps (runtime, resource, targetVAKON = ["§->"]) {
    const gate = resource.gate;
    let entryTargetVAKON;
    try {
      if (!gate || (gate.projection === undefined)) {
        throw new Error(`Resource ${resource.name} gate or projection missing`);
      }
      entryTargetVAKON = this.appendVPathSteps(runtime, gate.projection, targetVAKON);
      this.appendSchemaSteps(runtime, resource.schema, { targetVAKON: entryTargetVAKON });
      if (gate.filterCondition) {
        const filter = ["§?"];
        this.appendVPathSteps(runtime, gate.filterCondition, filter);
        filter.push(null);
        entryTargetVAKON.push(filter, false);
      }
      this.appendSchemaSteps(runtime, resource.schema,
            { entryTargetVAKON, expandProperties: true });
      return entryTargetVAKON;
    } catch (error) {
      throw this.wrapErrorEvent(error, 1, new Error(`appendGateProjectionSteps(${gate.name})`),
          "\n\truntime:", ...dumpObject(runtime),
          "\n\tgate:", ...dumpObject(gate),
          "\n\ttargetVAKON:", ...dumpObject(targetVAKON),
          "\n\tentryTargetVAKON:", ...dumpObject(entryTargetVAKON));
    }
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

  fillReplyFromResponse (...rest) {
    return _fillReplyFromResponse(this, ...rest);
  }

  // Update resource ops

  updateResource (vResource, patch,
        options: { discourse: Object, scope: Object, toPatchTarget: Object } = {}) {
    return _updateResource(this, vResource, patch, options);
  }

  // Rel ops

  addResourceProjector (projector) {
    return _addResourceProjector(this, projector);
  }

  relRequest (rel, options) {
    return _relRequest(this, rel, options);
  }

  createGetRelSelfHRef (
      runtime: Object,
      type: "resourceHRef" | "targetHRef" | null,
      maybeJSONSchema: string | Object) {
    let schema;
    try {
      schema = this.derefSchema(maybeJSONSchema);
      return _createGetRelSelfHRef(this, runtime, type, schema);
    } catch (error) {
      throw this.wrapErrorEvent(error, 1, new Error("resourceHRef"),
          "\n\tschema:", ...dumpObject(schema || maybeJSONSchema),
      );
    }
  }

  // Identity ops

  getIdentityRoles (identityChronicleURI) {
    return _getIdentityRoles(this, identityChronicleURI);
  }
}
