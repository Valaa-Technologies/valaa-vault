// @flow

import path from "path";
import fs from "fs";
import http from "http";

import { extendTrack } from "~/plot";
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
import { _vakonpileVPlot } from "./_vakonpileOps";

const Fastify = require("fastify");

// TODO(iridian, 2020-05): Extract PrefixRouter as a fully separate,
// standalone class. Right now each PrefixRouter is prototypically
// inherited from MapperService at runtime.
export type PrefixRouter = MapperService;

export default class MapperService extends FabricEventTarget {
  constructor (gateway, options, projectorCreators) {
    const { identity, port, httpsRedirectPort, address, fastify, ...rest } = options;
    super(gateway, rest.verbosity, rest.name);

    this._identity = identity;
    this._rolesByIdentity = {};
    this._port = port;
    this._address = address;
    this._projectorCreators = projectorCreators;

    const fastifyOptions = { ...fastify };
    if (fastifyOptions.https) {
      fastifyOptions.https = {
        ...fastifyOptions.https,
        key: fs.readFileSync(path.join(process.cwd(), fastifyOptions.https.key), "utf8"),
        cert: fs.readFileSync(path.join(process.cwd(), fastifyOptions.https.cert), "utf8"),
      };
    }
    this._rootFastify = Fastify(fastifyOptions || {});
    if (httpsRedirectPort) {
      this._htmlRedirectFromPort = httpsRedirectPort;
    }
    this._prefixRouters = {};
  }

  getGateway () { return this._parent; }

  getRootFastify () { return this._rootFastify; }

  createPrefixRouter (prefix, prefixConfig, parentPlog) {
    const service = this;
    const openapi = prefixConfig.openapi || { info: { name: "<missing>", version: "<missing>" } };
    try {
      if (this._prefixRouters[prefix]) {
        throw new Error(`Prefix router already exists for: <${prefix}>`);
      }
      if (!prefixConfig.openapi) {
        throw new Error(`Prefix config openapi section missing for prefix: <${prefix}>`);
      }
      const plog1 = this.opLog(1, parentPlog, `router`,
          `Creating prefix router for <${prefix}>`, prefixConfig);
      // console.log("prefix:", prefix, "\n\tconfig:", prefixConfig);
      const router = this._prefixRouters[prefix] =
          _createPrefixRouter(this, prefix, prefixConfig, plog1);
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
      return service.wrapErrorEvent(error, 0,
        new Error(`createPrefixRouter(${openapi.info.name}@${openapi.info.version}: <${prefix}>)`),
        "\n\tprefixConfig:", ...dumpObject(prefixConfig),
        "\n\tswaggerPrefix:", prefixConfig.swaggerPrefix,
        "\n\tschemas:", ...dumpObject(prefixConfig.schemas),
        "\n\troutes:", ...dumpObject({ routes: prefixConfig.routes }));
    }
  }

  start () {
    try {
      if (this._listening) return;
      this._listening = true;
      this.getRootFastify().listen(this._port, this._address || undefined,
          (error) => {
            if (error) throw error;
            this.infoEvent(0, `listening @`, this.getRootFastify().server.address(),
                "prepared prefixes:",
                ...[].concat(...Object.entries(this._prefixRouters).map(
                    ([prefix, { _config: { openapi: { info: { name, title, version } } } }]) =>
                        [`\n\t${prefix}:`, `${name}@${version} -`, title]
                )));
          });
      if (this._htmlRedirectFromPort && !this._redirectServer) {
        this._redirectServer = this.createRedirectServer(this._htmlRedirectFromPort, this._port);
      }
    } catch (error) {
      throw this.wrapErrorEvent(error, 1, `start()`,
          "\n\trouters:", ...dumpObject(this._prefixRouters));
    }
  }

  createRedirectServer (fromPort, toPort) {
    const toPortText = String(toPort) !== String(443) ? `:${String(toPort)}` : "";
    return http.createServer((req, res) => {
      const { headers: { host }, url } = req;
      if (host) {
        const redirectURL = `https://${host.split(":")[0]}${toPortText}${url}`;
        res.writeHead(301, { Location: redirectURL });
        res.end();
      }
    })
    .listen(fromPort);
  }

  async stop () {
    try {
      if (!this._listening) return undefined;
      this._listening = false;
      if (this._redirectServer) {
        this._redirectServer.close();
        this._redirectServer = null;
      }
      return await this.getRootFastify().close();
    } catch (error) {
      throw this.wrapErrorEvent(error, 1, new Error("stop()"),
          "\n\trouters:", ...dumpObject(this._prefixRouters));
    }
  }

  // PrefixRouter methods

  getEngine () { return this._engine; }
  getDiscourse () { return this._engine.discourse; }
  getSourcerer () { return this._engine.getSourcerer(); }
  getViewFocus () { return this._view.getFocus(); }
  getViewScope () { return this._engine.getRootScope(); }
  getSessionDuration () { return 86400 * 1.5; }

  isSessionAuthorizationEnabled () { return this._isSessionAuthorizationEnabled; }
  setSessionAuthorizationEnabled (value = true) { this._isSessionAuthorizationEnabled = value; }

  getRefreshSessionProjector () { return this._refreshSessionProjector; }
  setRefreshSessionProjector (projector) { this._refreshSessionProjector = projector; }


  /**
   * Attaches an initialized but routeless prefix router to its view
   * which whose chronicles have been loaded.
   *
   * This is done because creation of view and prefix router could
   * happen in either order.
   *
   * @param {*} view
   * @param {*} viewName
   * @returns
   * @memberof MapperService
   */
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
    try {
      if (!route.url) throw new Error(`Route url undefined`);
      if (!route.projector) throw new Error(`Route projector undefined`);
      if (!route.method) throw new Error(`Route method undefined`);
      if (!route.config) throw new Error(`Route config undefined`);
      const createProjector = (this._projectorCreators[route.projector] || {})[route.method];
      if (!createProjector) {
        throw new Error(`No projector found for '${route.projector} ${route.method}'`);
      }
      route.params = [];
      route.parts = route.url.split("/").slice(1).map(part => {
        for (let i = 0; i !== part.length; ++i) {
          if (part[i] !== ":") continue;
          ++i;
          if (part[i] === ":") continue;
          let nameI = i;
          for (; nameI !== part.length; ++nameI) {
            if (part[nameI] === "(" || part[nameI] === "-" || part[nameI] === ":") break;
          }
          route.params.push(part.slice(i, nameI));
          if (part[nameI] === "(") {
             for (let depth = 1; depth && nameI !== part.length; ++nameI) {
              if (part[nameI] === "\\") ++nameI;
              else if (part[nameI] === "(") ++depth;
              else if (part[nameI] === ")") --depth;
            }
          }
          if ((i === 1) && (nameI === part.length)) {
            return route.params.length - 1;
          }
          i = nameI - 1;
        }
        return part;
      });
      const projector = createProjector(this, route);
      if (projector == null) return undefined;
      if (!projector.name) projector.name = this._routeName(route);
      projector.route = route;
      projector.config = route.config;
      return projector;
    } catch (error) {
      throw this.wrapErrorEvent(error, 1, `createRouteProjector(${this._routeName(route)})`,
          "\n\troute:", ...dumpObject(route));
    }
  }

  // Runtime ops

  getProjectors (options = {}) {
    return this._projectors.filter(projector =>
        (!options.url || (options.url === projector.route.url))
        && (!options.projector || (options.projector === projector.route.projector))
        && (!options.method || (options.method === projector.route.method)));
  }

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
            new Error(`presolveRulesToScope(ruleName: '${ruleName}')`),
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
    return `${route.method}-${route.projector} <${route.url}>`;
  }

  // Build ops

  derefSchema (maybeJSONSchemaOrName: string | Object) {
    return _derefSchema(this, maybeJSONSchemaOrName);
  }

  appendSchemaSteps (runtime, maybeJSONSchema, {
    expandProperties, isValOSFields, targetTrack = ["§->"], entryTargetTrack,
  } = {}) {
    let schema, innerTargetTrack;
    if (!maybeJSONSchema) return targetTrack || entryTargetTrack;
    try {
      schema = this.derefSchema(maybeJSONSchema);
      innerTargetTrack = entryTargetTrack
          || this.appendVPlotSteps(runtime, (schema.valospace || {}).reflection, targetTrack);
      if (!innerTargetTrack) {
        if (schema.type !== "array") innerTargetTrack = targetTrack;
        else targetTrack.push((innerTargetTrack = ["§map"]));
      }
      _appendSchemaSteps(this, runtime, schema, innerTargetTrack, expandProperties, isValOSFields);
      return targetTrack;
    } catch (error) {
      throw this.wrapErrorEvent(error, 1, new Error("appendSchemaSteps"),
          "\n\truntime:", ...dumpObject(runtime),
          "\n\tschema:", dumpify(schema),
          "\n\ttargetTrack:", ...dumpObject(targetTrack),
          "\n\tinnerTargetTrack:", ...dumpObject(innerTargetTrack),
        );
    }
  }

  appendVPlotSteps (runtime, vplot, targetTrack = ["§->"]) {
    let track, maybeInnerPluralMapTrack;
    try {
      if (vplot === undefined) return undefined;
      if (!vplot) return targetTrack;
      track = _vakonpileVPlot(vplot, runtime);
      extendTrack(targetTrack, track);
      if (Array.isArray(track)) {
        maybeInnerPluralMapTrack = track[track.length - 1];
        if (maybeInnerPluralMapTrack[0] === "§map") return maybeInnerPluralMapTrack;
      }
      return targetTrack;
    } catch (error) {
      throw this.wrapErrorEvent(error, 1, new Error("appendSchemaSteps"),
          "\n\truntime:", ...dumpObject(runtime),
          "\n\tvplot:", ...dumpObject(vplot),
          "\n\ttargetTrack:", ...dumpObject(targetTrack),
          "\n\tvplotTrack:", ...dumpObject(runtime),
          "\n\tmaybeInnerPluralMapTrack:", ...dumpObject(maybeInnerPluralMapTrack));
    }
  }

  appendGateProjectionSteps (runtime, resource, targetTrack = ["§->"]) {
    const gate = resource.gate;
    let entryTargetTrack;
    try {
      if (!gate || (gate.projection === undefined)) {
        throw new Error(`Resource ${resource.name} gate or projection missing`);
      }
      entryTargetTrack = this.appendVPlotSteps(runtime, gate.projection, targetTrack);
      this.appendSchemaSteps(runtime, resource.schema, { targetTrack: entryTargetTrack });
      if (gate.filterCondition) {
        const filter = ["§?"];
        this.appendVPlotSteps(runtime, gate.filterCondition, filter);
        filter.push(null);
        entryTargetTrack.push(filter, false);
      }
      this.appendSchemaSteps(runtime, resource.schema,
            { entryTargetTrack, expandProperties: true });
      return entryTargetTrack;
    } catch (error) {
      throw this.wrapErrorEvent(error, 1, new Error(`appendGateProjectionSteps(${gate.name})`),
          "\n\truntime:", ...dumpObject(runtime),
          "\n\tgate:", ...dumpObject(gate),
          "\n\ttargetTrack:", ...dumpObject(targetTrack),
          "\n\tentryTargetTrack:", ...dumpObject(entryTargetTrack));
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
