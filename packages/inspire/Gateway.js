// @flow

import "@babel/polyfill";
import path from "path";

import { Map as ImmutableMap } from "immutable";

import * as valosRaem from "~/raem";
import * as valosTools from "~/tools";
import * as valosScript from "~/script";
import * as valosSourcerer from "~/sourcerer";
import * as valosEngine from "~/engine";
import * as valosInspire from "~/inspire";

import { naiveURI } from "~/raem/ValaaURI";
import createRootReducer from "~/raem/tools/createRootReducer";
import createValidateEventMiddleware from "~/raem/redux/middleware/validateEvent";
import createProcessCommandIdMiddleware from "~/raem/redux/middleware/processCommandId";
import { createBardMiddleware } from "~/raem/redux/Bard";
import Corpus from "~/raem/Corpus";

import upgradeEventTo0Dot2 from "~/sourcerer/tools/event-version-0.2/upgradeEventTo0Dot2";
import EVENT_VERSION from "~/sourcerer/tools/EVENT_VERSION";
import IdentityManager from "~/sourcerer/FalseProphet/IdentityManager";

import Engine from "~/engine/Engine";
import EngineContentAPI from "~/engine/EngineContentAPI";
import extendValosheathWithEngine from "~/engine/valosheath";

import InspireView from "~/inspire/InspireView";

import { registerVidgets } from "~/inspire/ui";
import { Revelation, lazy } from "~/inspire/Revelation";
import extendValosheathWithInspire from "~/inspire/valosheath";

import { setGlobalLogger } from "~/tools/wrapError";

import getGlobal from "~/gateway-api/getGlobal";
import { byteArrayFromBase64 } from "~/gateway-api/base64";

const fetchJSON = require("@valos/tools/fetchJSON").default;
const patchWith = require("@valos/tools/patchWith").default;

const { AuthorityNexus, FalseProphet, Oracle, Sourcerer, Scribe } = valosSourcerer;
const {
  dumpObject, inBrowser, invariantify, isPromise, FabricEventTarget, mapEagerly, thenChainEagerly,
} = valosTools;

export default class Gateway extends FabricEventTarget {
  constructor (options: Object) {
    super(options.name, options.verbosity, options.logger);
    if (options.siteRoot === undefined) {
      throw new Error("Required gateway.options.siteRoot is undefined");
    }
    if (options.revelationRoot === undefined) {
      throw new Error("Required gateway.options.revelationRoot is undefined");
    }
    if (options.logger) setGlobalLogger(options.logger);
    this.siteRoot = options.siteRoot;
    this.revelationRoot = options.revelationRoot;
    this.domainRoot = options.domainRoot;
    this._pendingViews = [];
  }

  callRevelation (Type: Function | any) {
    if (typeof Type !== "function") return Type;
    return new Type({ gateway: this, logger: this.getLogger() });
  }

  static moduleMatcherString = "^((@[^@/]+\\/)?([^/]+))(\\/(.*))?$";
  static moduleMatcher = new RegExp(Gateway.moduleMatcherString);

  /**
   * valos.gateway.require is the entry point for ValOS fabric library
   * imports from inside spindles.
   *
   * @param {string} module
   * @returns
   * @memberof Gateway
   */
  require (module: string, options: Object) {
    // TODO(iridian, 2018-12): fabric library version semver
    //   compatibility checking against spindle package.json dependencies
    // TODO(iridian, 2018-12): spindle-sourced library registration
    //   system for webpack environments
    // TODO(iridian, 2018-12): correlate require semantics with import
    //   semantics
    // TODO(iridian, 2018-12): evaluate making require contents
    //   available as the default require from within valospace

    // TODO(iridian): This issues a webpack warning but is not an
    // actual fault; require will never be called in webpack context
    // where inBrowser always returns true.
    // Webpack unfortunately doesn't offer a convenient way to suppress
    // individual lines to silence warnings. Although it probably would
    // be the correct solution would be to have this structurally
    // abstracted in a @valos/platform-dependent-tools or similar
    // (also contain the inBrowser code) with inherently different
    // paths for various platform-specific functionalities like the
    // require here.
    try {
      if (!inBrowser()) {
        let modulePath;
        if (options) {
          modulePath = require.resolve(module);
          const basename = path.posix.basename(modulePath);
          if ((basename === "index.js") || (basename === "index.json")) {
            // TODO(iridian, 2020-01): Fix handling directories with package.json:main set
            options.wasDirectory = true;
          }
        }
        return require(modulePath || module);
      }

      const parts = Gateway.moduleMatcher.exec(module);
      if (!parts) {
        throw new Error(`Invalid valos.require module: "${module
            }" doesn't match regex /${Gateway.moduleMatcherString}/)`);
      }
      const scope = parts[2];
      const library = parts[3];
      const subPath = parts[4];
      let ret;
      if (scope === "@valos/") {
        // Each of these must be explicitly require'd, so that
        // 1. webpack knows to pack the library sources to the bundle
        // 2. the require is still only performed when actually needed as
        //    not all ValOS sub-modules need to be loaded at startup.
        // TODO(iridian, 2018-12):
        //    The above point 2. is a bit moot as there are a lot of
        //    top-level library index.js imports in ValOS libs; all the
        //    library content is imported via their index.js anyway.
        //    When timing is right all the ValOS internal imports should
        //    be replaced with most specific imports possible.
        if (library === "engine") ret = valosEngine;
        else if (library === "inspire") ret = valosInspire;
        else if (library === "sourcerer") ret = valosSourcerer;
        else if (library === "raem") ret = valosRaem;
        else if (library === "script") ret = valosScript;
        else if (library === "tools") ret = valosTools;
        else throw new Error(`Unrecognized valos.require @valos library: '${library}'`);
      } else if (scope) throw new Error(`Unrecognized valos.require scope: '${scope}'`);
      else throw new Error(`Unrecognized valos.require library: '${library}'`);
      if (subPath) {
        throw new Error(`Unsupported valos.require sub-path: "${subPath
            }" (only top level library require's supported for now)`);
      }
      return ret;
    } catch (error) {
      throw this.wrapErrorEvent(error, new Error(`require("${module}")`),
          "\n\toptions:", ...dumpObject(options));
    }
  }

  fetchJSON (...rest) { return fetchJSON(...rest); }

  async initialize (revelation: Revelation) {
    try {
/*
 * Process the initially served landing page and extract the initial
 * ValOS configuration ('revelation') from it. The revelation might be
 * device/locality specific. The revelation might contain initial event
 * log snapshots for select chronicles. These event logs might be
 * provided by the landing page provider and might contain relevant
 * chronicle for showing the front page; alternatively the revelation
 * might be served by the local service worker which intercepted the
 * landing page network request and might contain full snapshots of all
 * chronicles that were active during previous session, allowing full
 * offline functionality. Alternatively the service worker can provide
 * the event logs through indexeddb and keep the landing page
 * revelation minimal; whatever is most efficient.
 */
      this.revelation = await lazy(this._interpretRevelation(revelation));
      this.gatewayRevelation = await lazy(this.revelation.gateway);
      if (this.gatewayRevelation.name) this.setName(await lazy(this.gatewayRevelation.name));

      this.setVerbosity(this.gatewayRevelation.verbosity || 0);

      this.authorityNexus = await this._establishAuthorityNexus(this.gatewayRevelation);

      // Create the stream router ('oracle') which uses scribe as its direct upstream, but which
      // manages the remote authority connections.
      this.oracle = await this._summonOracle(this.gatewayRevelation, this.authorityNexus);

      // Create a connector (the 'scribe') to the locally backed event log / bvob indexeddb cache
      // ('scriptures') based on the revelation.
      this.scribe = await this._proselytizeScribe(this.gatewayRevelation, this.oracle);

      this.corpus = await this._incorporateCorpus(this.gatewayRevelation);

      // Create the the main in-memory false prophet using the stream router as its upstream.
      this.falseProphet = await this._proselytizeFalseProphet(this.gatewayRevelation,
          this.corpus, this.scribe);

      this.identity = await this._establishIdentity(this.gatewayRevelation, this.falseProphet);

      // Create a connection and an identity for the gateway towards false prophet
      this.discourse = await this._initiateDiscourse(this.gatewayRevelation, this.falseProphet);

      this.spindleRevelations = (await lazy(this.revelation.spindles)) || {};
      await this.attachSpindles(await lazy(this.gatewayRevelation.spindlePrototypes));

      this.prologueRevelation = await lazy(this.revelation.prologue);

      // Locate entry point event log (prologue), make it optimally available through scribe,
      // narrate it with false prophet and get the false prophet connection for it.
      ({ connections: this.prologueConnections, rootConnection: this._rootConnection }
          = await this._narratePrologues(this.prologueRevelation));

      this.clockEvent(1, `vidgets.register`, `Registering builtin Inspire vidgets`);
      registerVidgets();
      const spindleNames = Object.keys(this._attachedSpindles);
      this.clockEvent(1, `initialized`, "Gateway initialized");
      this._isInitialized = true;

      this.viewRevelations = (await lazy(this.revelation.views)) || {};

      this.clockEvent(1, `spindles.notify`,
          `Notifying ${spindleNames.length} spindles of gateway initialization:`,
          spindleNames.join(", "));
      for (const spindle of Object.values(this._attachedSpindles)) {
        await this._notifySpindle(spindle, "onGatewayInitialized", this, spindle.revelation);
      }
    } catch (error) {
      throw this.wrapErrorEvent(error, 1, "initialize", "\n\tthis:", ...dumpObject(this));
    }
  }

  async terminate () {
    this.clockEvent(1, `spindles.terminating`,
        `Notifying spindles of gateway termination:`,
        Object.keys(this._attachedSpindles).join(" "));
    return Promise.all(Object.values(this._attachedSpindles).map(spindle =>
        this._notifySpindle(spindle, "onGatewayTerminating")));
  }

  getRootChronicleURI () {
    return this._rootConnection.getChronicleURI();
  }

  getRootFocusURI () {
    return this._rootFocusURI || this.getRootChronicleURI();
  }

  getIdentityManager () {
    return this.identity;
  }

  createAndConnectViewsToDOM (views: { [string]: {
    container: Object, hostGlobal: Object, window: Object,
    name: string, size: Object, viewRootId: string, lensURI: any, verbosity: ?number,
  } }, createView) {
    this._hostComponents = { createView };
    for (const { container, hostGlobal, window } of Object.values(views)) {
      if (this._hostComponents.container == null) this._hostComponents.container = container;
      if (this._hostComponents.hostGlobal == null) this._hostComponents.global = hostGlobal;
      if (this._hostComponents.window == null) this._hostComponents.window = window;
    }
    for (const [viewId, config, resolve, reject] of [
      ...Object.entries(views || {}),
      ...this._pendingViews || [],
      ...Object.entries(this.viewRevelations),
    ]) {
      thenChainEagerly(this.addView(viewId, config),
          view => resolve && resolve(view),
          errorOnCreateAndConnectViewsToDOM.bind(this, viewId, config, reject));
    }
    return this._views;
    function errorOnCreateAndConnectViewsToDOM (viewId, config, reject, error) {
      const wrappedError = this.wrapErrorEvent(error, 1,
          new Error(`createAndConnectViewsToDom(view: ${viewId}`),
              "\n\tviewConfig:", ...dumpObject(config));
      if (reject) reject(wrappedError);
      this.outputErrorEvent(wrappedError,
          `Exception caught during createAndConnectViewsToDOM():${
            ""}\n\n\n\tVIEW NOT ADDED: ${viewId}\n\n`);
    }
  }

  addView (viewId, viewConfig) {
    return (!this._hostComponents)
        ? new Promise((resolve, reject) =>
            this._pendingViews.push([viewId, viewConfig, resolve, reject]))
        : this.createAndConnectViewToDOM(viewId, { ...this._hostComponents, ...viewConfig });
  }

  createAndConnectViewToDOM (viewId, {
    container, global: hostGlobal, verbosity = this.getVerbosity(),
    createView = (options) => new InspireView(options),
    ...paramViewConfig
  }) {
    if (!this._views) this._views = {};
    if (this._views[viewId]) throw new Error(`View ${viewId} already exists`);
    const view = createView({ gateway: this, engine: null, name: viewId, verbosity });
    view.clockEvent(1, () => [`view.create`,
        `createView({ name: ${viewId}, verbosity: ${verbosity} })`]);
    let rootScope;
    let viewConfig;
    let identity;
    const gateway = this;
    this._views[viewId] = thenChainEagerly(view, view.addChainClockers(1, "view.create.ops", [
      async function _createViewOptions () {
        const views = (await lazy(gateway.revelation.views)) || {};
// TODO(iridian, 2020-01): Streamline the view parameterization hodgepodge
// monstrosity to use this revelationConfig as much as possible.
        const revelationConfig = (await lazy(views[viewId])) || {};
        viewConfig = patchWith(
            { verbosity, viewRootId: `valos-gateway--${viewId}--view-root` },
            ["...", revelationConfig, paramViewConfig],
            { complexPatch: "setOnInitialize" });
        view.setRawName(viewId);
        view.setName(`${viewConfig.name}-View`);
        view.setVerbosity(viewConfig.verbosity);
      },
      function _createIdentity () {
        identity = new IdentityManager({
          sourcerer: gateway.falseProphet,
          ...(viewConfig.identity || {}),
        });
        return identity;
      },
      function _createEngine () {
        const engineOptions = {
          name: `${viewConfig.name} Engine`,
          ...(viewConfig.engine || {}),
          logger: gateway.getLogger(),
          sourcerer: gateway.falseProphet,
          revelation: gateway.revelation,
        };
        const engine = new Engine(engineOptions);
        gateway.clockEvent(1, () => [
          `${viewConfig.name}.engine.create`,
          `Created Engine ${engine.debugId()}`,
          ...(!gateway.getVerbosity() ? [] : [", with:",
            "\n\tengineOptions:", ...dumpObject(engineOptions),
            "\n\tengine:", ...dumpObject(engine),
          ]),
        ]);
        view.setEngine(engine);
        return engine;
      },
      function _buildRootScope (engine) {
        rootScope = engine.getRootScope();
        const hostDescriptors = engine.getHostDescriptors();
        extendValosheathWithEngine(
            rootScope, hostDescriptors, engine.discourse.getRootDiscourse());
        if (!viewConfig.defaultAuthorityURI) {
          extendValosheathWithInspire(rootScope, hostDescriptors, hostGlobal || getGlobal());
        } else {
          // FIXME(iridian): Implement this.schemes - still missing.
          const defaultAuthorityConfig = gateway.schemes[viewConfig.defaultAuthorityURI];
          invariantify(defaultAuthorityConfig,
              `defaultAuthorityConfig missing when looking for default authority ${
                    String(viewConfig.defaultAuthorityURI)}`);
          extendValosheathWithInspire(rootScope, hostDescriptors, hostGlobal || getGlobal(),
                defaultAuthorityConfig, engine);
        }
        rootScope.valos.gateway = gateway;
        rootScope.valos.identity = identity;
        rootScope.valos.view = {};
        rootScope.console = Object.assign(Object.create(engine), {
          info: function verboseInfoEvent (...rest) {
            gateway.infoEvent(0, ...[].concat(...rest.map(_trimObjects)));
          },
          log: function verboseLogEvent (...rest) {
            gateway.logEvent(0, ...[].concat(...rest.map(_trimObjects)));
          },
          warn: function verboseWarnEvent (...rest) {
            gateway.warnEvent(0, ...[].concat(...rest.map(_trimObjects)));
          },
          error: function verboseErrorEvent (...rest) {
            gateway.errorEvent(0, ...[].concat(...rest.map(_trimObjects)));
          },
        });
        function _trimObjects (entry) {
          if (entry && (typeof entry === "object") && !inBrowser()) return dumpObject(entry);
          return entry;
        }
      },
      function _attachView () {
        return view.attach(container, viewConfig);
      },
      function _notifyViewSpindles (attachedView) {
        gateway._views[viewId] = rootScope.valos.view = attachedView;
        attachedView.rootScope = rootScope;
        const attachedViewAwareSpindles = Object.values(gateway._attachedSpindles)
            .filter(spindle => spindle.onViewAttached);
        attachedView.clockEvent(1, () => [`view.attach.spindles.notify`,
          `Notifying ${attachedViewAwareSpindles.length} attached view-aware spindles`,
        ]);
        return mapEagerly(attachedViewAwareSpindles,
            spindle => gateway._notifySpindle(spindle, "onViewAttached", attachedView, viewId));
      },
      reactions => gateway._views[viewId].clockEvent(1, () => [`view.attach.spindles.reactions`,
        "\n\tspindle reactions:", ...dumpObject(reactions.filter(notNull => notNull)),
      ]),
      () => gateway._views[viewId],
    ]), error => {
      throw this.wrapErrorEvent(error, 1, new Error(`createAndConnectViewToDOM(${viewId})`),
          "\n\tcontainer:", ...dumpObject(container),
          "\n\tviewConfig:", ...dumpObject(paramViewConfig));
    });
    return this._views[viewId];
  }

  /**
   * Processes the landing page and extracts the revelation from it.
   *
   * @param {Object} rawRevelation
   * @returns
   *
   * @memberof Gateway
   */
  async _interpretRevelation (revelation: Revelation): Object {
    try {
      this.clockEvent(1, () => ["gateway.revelation",
          `Interpreted revelation`, ...dumpObject(revelation)]);
      return revelation;
    } catch (error) {
      throw this.wrapErrorEvent(error, 1, new Error(`interpretRevelation`),
          "\n\trevelation:", ...dumpObject(revelation));
    }
  }

  async _establishAuthorityNexus (gatewayRevelation: Object) {
    let nexusOptions;
    try {
      nexusOptions = {
        name: "Inspire AuthorityNexus",
        authorityConfigs: await lazy(gatewayRevelation.authorityConfigs),
        ...(await lazy(gatewayRevelation.nexus) || {}),
      };
      this.clockEvent(1, () => [`authorityNexus.create`,
        "new AuthorityNexus", ...dumpObject(nexusOptions)]);
      const nexus = new AuthorityNexus(nexusOptions);
      nexus.clockEvent(1, `create`,
          ...(!this.getVerbosity() ? [] : [", with:",
            "\n\toptions:", ...dumpObject(nexusOptions),
            "\n\tnexus:", ...dumpObject(nexus),
          ]));
      return nexus;
    } catch (error) {
      throw this.wrapErrorEvent(error, 1, new Error(`establishAuthorityNexus`),
          "\n\tnexusOptions:", ...dumpObject(nexusOptions));
    }
  }

  async _proselytizeScribe (gatewayRevelation: Object, oracle: Oracle): Promise<Scribe> {
    let scribeOptions;
    try {
      scribeOptions = {
        name: "Inspire Scribe",
        logger: this.getLogger(),
        upstream: oracle,
        databaseAPI: gatewayRevelation.scribe.getDatabaseAPI(),
        ...await lazy(gatewayRevelation.scribe),
      };
      this.clockEvent(1, () => [`scribe.create`,
        "new Scribe", ...dumpObject(scribeOptions)]);
      const scribe = new Scribe(scribeOptions);
      this.clockEvent(1, `scribe.initiate`, "scribe.initiate()");
      await scribe.initiate();

      this.warnEvent(1, () => [
        `Proselytized Scribe '${scribe.debugId()}'`,
        ...(!this.getVerbosity() ? [] : [", with:",
          "\n\tscribeOptions:", ...dumpObject(scribeOptions),
          "\n\tscribe:", ...dumpObject(scribe),
        ]),
      ]);
      return scribe;
    } catch (error) {
      throw this.wrapErrorEvent(error, 1, new Error(`proselytizeScribe`),
          "\n\tscribeOptions:", ...dumpObject(scribeOptions));
    }
  }

  async _summonOracle (gatewayRevelation: Object, authorityNexus: AuthorityNexus):
      Promise<Sourcerer> {
    let oracleOptions;
    try {
      oracleOptions = {
        name: "Inspire Oracle",
        logger: this.getLogger(),
        authorityNexus,
        ...await lazy(gatewayRevelation.oracle),
      };
      this.clockEvent(1, () => [`oracle.create`,
        "new Oracle", ...dumpObject(oracleOptions)]);
      const oracle = new Oracle(oracleOptions);
      this.warnEvent(1, () => [
        `Proselytized Oracle ${oracle.debugId()}`,
        ...(!this.getVerbosity() ? [] : [", with:",
          "\n\toracleOptions:", ...dumpObject(oracleOptions),
          "\n\toracle:", ...dumpObject(oracle),
        ]),
      ]);
      return oracle;
    } catch (error) {
      throw this.wrapErrorEvent(error, 1, new Error(`summonOracle`),
          "\n\toracleOptions:", ...dumpObject(oracleOptions),
          "\n\tauthorityNexus:", ...dumpObject(authorityNexus));
    }
  }

  async _incorporateCorpus (gatewayRevelation: Object) {
    const name = "Inspire Corpus";
    const reducerOptions = {
      ...EngineContentAPI, // schema, validators, reducers
      eventLogger: this,
      ...await lazy(gatewayRevelation.reducer),
    };
    const { schema, validators, mainReduce, subReduce } = createRootReducer(reducerOptions);

    const middlewares = [
      _createProcessCommandVersionMiddleware(EVENT_VERSION),
      createProcessCommandIdMiddleware(undefined, schema),
      createValidateEventMiddleware(validators, EVENT_VERSION, EVENT_VERSION),
      createBardMiddleware(),
    ];

    const corpusOptions = {
      name, schema, middlewares,
      reduce: mainReduce,
      subReduce,
      initialState: new ImmutableMap(),
      logger: this.getLogger(),
      ...await lazy(gatewayRevelation.corpus),
    };
    this.clockEvent(1, () => [`corpus.create`, "new Corpus", ...dumpObject(corpusOptions)]);
    return new Corpus(corpusOptions);

    function _createProcessCommandVersionMiddleware (version) {
      // Naive versioning which accepts versions given in or uses the supplied version as default
      return (/* store */) => next => (command, ...rest: any[]) => {
        const aspects = command.aspects || (command.aspects = { event: command });
        if (!aspects.version) aspects.version = version;
        else if (aspects.version !== version) {
          throw new Error(`Invalid command version '${aspects.version}', expected '${version}'`);
        }
        return next(command, ...rest);
      };
    }
  }

  async _proselytizeFalseProphet (gatewayRevelation: Object, corpus: Corpus, upstream: Sourcerer):
      Promise<Sourcerer> {
    let falseProphetOptions;
    try {
      this._commandCountListeners = new Map();
      falseProphetOptions = {
        name: "Inspire FalseProphet",
        corpus,
        upstream,
        schema: EngineContentAPI.schema,
        logger: this.getLogger(),
        commandNotificationMinDelay: 500,
        onCommandCountUpdate: (totalCount: number, chronicleCommandCounts: Object) => {
          this._totalCommandCount = totalCount;
          this._chronicleCommandCounts = chronicleCommandCounts;
          this._commandCountListeners.forEach((listener, component) => {
            try {
              listener(totalCount, chronicleCommandCounts);
            } catch (error) {
              this.outputErrorEvent(this.wrapErrorEvent(error, 1,
                      new Error("onCommandCountUpdate.listener()"),
                      "\n\tlistener key:", ...dumpObject(component),
                      "\n\ttotalCount:", totalCount,
                      "\n\tchronicleCommandcounts:", ...dumpObject(chronicleCommandCounts)),
                  "Exception caught during Gateway.onCommandCountUpdate.listener call",
                  this.getLogger());
            }
          });
        },
        ...await lazy(gatewayRevelation.falseProphet),
      };
      this.clockEvent(1, () => [`falseProphet.create`,
        "new FalseProphet", ...dumpObject(falseProphetOptions)]);
      const falseProphet = new FalseProphet(falseProphetOptions);
      this.warnEvent(1, () => [
        `Proselytized FalseProphet ${falseProphet.debugId()}`,
        ...(!this.getVerbosity() ? [] : [", with:",
          "\n\tfalseProphetOptions:", ...dumpObject(falseProphetOptions),
          "\n\tfalseProphet:", ...dumpObject(falseProphet),
        ]),
      ]);
      return falseProphet;
    } catch (error) {
      throw this.wrapErrorEvent(error, 1, new Error(`proselytizeFalseProphet`),
          "\n\tfalseProphetOptions:", ...dumpObject(falseProphetOptions),
          "\n\tupstream:", ...dumpObject(upstream));
    }
  }

  getTotalCommandCount () { return this._totalCommandCount || 0; }
  getChronicleStatuses (options: { listEmpty: boolean }) {
    if (!this._chronicleCommandCounts) return {};
    if (options && options.listEmpty) return this._chronicleCommandCounts;
    const ret = {};
    for (const [key, count] of Object.entries(this._chronicleCommandCounts)) {
      if (count) {
        try {
          const connection = this.falseProphet.acquireConnection(key, { newConnection: false });
          ret[key] = connection.getStatus();
        } catch (error) {
          ret[key] = { commands: count };
        }
      }
    }
    return ret;
  }

  setCommandCountListener (component: Object,
      callback: (totalCount: number, chronicleCommandCounts: Object) => void) {
    if (!callback) this._commandCountListeners.delete(component);
    else {
      this._commandCountListeners.set(component, callback);
      callback(this._totalCommandCount, this._chronicleCommandCounts);
    }
  }

  async _establishIdentity (gatewayRevelation: Object, falseProphet: FalseProphet) {
    let identityOptions, identity;
    try {
      identityOptions = {
        ...((await lazy(gatewayRevelation.identity)) || {}),
        sourcerer: falseProphet,
      };
      this.clockEvent(1, () => [`falseProphet.identity.create`,
        "new IdentityManager", ...dumpObject(identityOptions)]);
      identity = new IdentityManager({
        ...identityOptions,
      });
      this.warnEvent(1, () => [
        `Established Gateway Identity ${identity.debugId()}`,
        ...(!this.getVerbosity() ? [] : [", with:",
          "\n\tidentityOptions:", ...dumpObject(identityOptions),
          "\n\tidentity:", ...dumpObject(identity),
        ]),
      ]);
      return identity;
    } catch (error) {
      throw this.wrapErrorEvent(error, 1, new Error(`establishIdentity`),
          "\n\tdiscourseOptions:", ...dumpObject(identityOptions),
          "\n\tfalseProphet:", ...dumpObject(falseProphet),
          "\n\tidentity:", ...dumpObject(identity));
    }
  }

  async _initiateDiscourse (gatewayRevelation: Object, falseProphet: FalseProphet) {
    let discourseOptions, discourse;
    try {
      discourseOptions = {
        ...((await lazy(gatewayRevelation.discourse)) || {}),
      };
      this.clockEvent(1, () => [`falseProphet.discourse.create`,
        "new FalseProphetDiscourse", ...dumpObject(discourseOptions)]);
      discourse = falseProphet.createDiscourse(this, discourseOptions);
      this.warnEvent(1, () => [
        `Initiated FalseProphetDiscourse ${discourse.debugId()}`,
        ...(!this.getVerbosity() ? [] : [", with:",
          "\n\tdiscourseOptions:", ...dumpObject(discourseOptions),
          "\n\tdiscourse:", ...dumpObject(discourse),
        ]),
      ]);
      return discourse;
    } catch (error) {
      throw this.wrapErrorEvent(error, 1, new Error(`initiateDiscourse`),
          "\n\tdiscourseOptions:", ...dumpObject(discourseOptions),
          "\n\tfalseProphet:", ...dumpObject(falseProphet),
          "\n\tdiscourse:", ...dumpObject(discourse));
    }
  }

  _attachedSpindles = {};

  getSpindle (name) {
    const ret = this._attachedSpindles[name];
    if (!ret) throw new Error(`No spindle found with name "${name}"`);
    return ret;
  }

  getAttachedSpindle (name) {
    this.warnEvent("Gateway.getAttachedSpindle DEPRECATED in favor of getSpindle");
    return this.getSpindle(name);
  }

  async attachSpindle (spindlePrototype: Promise<Object>) {
    return this.attachSpindles([spindlePrototype]);
  }

  async attachSpindles (spindlePrototypes_: (Promise<Object> | Object)[]) {
    this.clockEvent(1, `spindles.obtain`,
        `Obtaining ${spindlePrototypes_.length} spindle prototypes`);
    const spindlePrototypes = await Promise.all(spindlePrototypes_);
    const newSpindleLookup = {};
    const spindleNames = [];
    await Promise.all(spindlePrototypes.map(async spindlePrototype => {
      if (newSpindleLookup[spindlePrototype.name]) {
        this.errorEvent(`Spindle '${spindlePrototype.name}' already being added:`,
            newSpindleLookup[spindlePrototype.name],
            "\n\tskipping adding a new duplicate:", ...dumpObject(spindlePrototype));
      }
      if (this._attachedSpindles[spindlePrototype.name]) {
        throw new Error(`Spindle '${spindlePrototype.name}' already attached`);
      }
      spindleNames.push(spindlePrototype.name);
      const spindleRevelation = await lazy(this.spindleRevelations[spindlePrototype.name]);
      newSpindleLookup[spindlePrototype.name] = spindlePrototype.attachSpawn
          ? spindlePrototype.attachSpawn(this, spindleRevelation)
          : Object.assign(Object.create(spindlePrototype),
              { gateway: this, revelation: spindleRevelation });
    }));
    this.clockEvent(1, `spindles.attach`, `Attaching ${spindleNames.length} spindles:`,
        spindleNames.join(", "));
    for (const name of spindleNames) await this._attachSpindle(name, newSpindleLookup[name]);
  }

  _attachSpindle (name: string, spindle: Object) {
    try {
      this._attachedSpindles[name] = spindle;
      for (const schemeModule of Object.values(spindle.schemeModules || {})) {
        const called = this.callRevelation(schemeModule);
        this.authorityNexus.addSchemeModule(called);
      }
      for (const authorityConfig of Object.values(spindle.authorityConfigs || {})) {
        this.authorityNexus.addAuthorityPreConfig(authorityConfig);
      }
      for (const MediaDecoder_: any of Object.values(spindle.mediaDecoders || {})) {
        this.oracle.getDecoderArray().addDecoder(this.callRevelation(MediaDecoder_));
      }
      return this._isInitialized && thenChainEagerly(null, [
        () => this._notifySpindle(spindle, "onGatewayInitialized", this, spindle.revelation),
        ...Object.keys(this._views || {}).map(viewName =>
        // Do not block for views to init
            () => !isPromise(this._views[viewName])
        // Do wait for spindle itself
                && this._notifySpindle(spindle, "onViewAttached", this._views[viewName], viewName))
      ]);
    } catch (error) {
      throw this.wrapErrorEvent(error, 1, new Error(`attachSpindle(${name})`),
          "\n\tspindle:", ...dumpObject(spindle),
          "\n\tspindle proto:", ...dumpObject(Object.getPrototypeOf(spindle)),
      );
    }
  }

  _notifySpindle (spindle, notifyMethodName, ...notifyParameters) {
    if (!spindle[notifyMethodName]) return;
    thenChainEagerly(
        spindle[notifyMethodName](...notifyParameters),
        result => this.infoEvent(1, () => [
          `Notify '${notifyMethodName}' complete to spindle`, spindle.name,
          "\n\tresult:", ...dumpObject(result),
        ]),
        error => this.outputErrorEvent(error,
            `Exception caught during notify '${notifyMethodName}' to spindle ${spindle.name}`));
  }

  async _narratePrologues (prologueRevelation: Object) {
    let prologues;
    try {
      this.clockEvent(1, `prologues.extract`, `Determining prologues and the root partition <${
          rootPartitionURI}>`);
      const rootPartitionURI = this.prologueRevelation.rootPartitionURI
          && naiveURI.createPartitionURI(await lazy(this.prologueRevelation.rootPartitionURI));
      this.rootLensURI = await lazy(this.prologueRevelation.rootLensURI);
      prologues = await this._determineRevelationPrologues(prologueRevelation, rootChronicleURI);
      this.warnEvent(1, () => [
        `Extracted ${prologues.length} prologues from the revelation`,
        "\n\tprologue chronicles:",
            `<${prologues.map(({ partitionURI }) => partitionURI).join(">, <")}>`,
        "\n\troot chronicle:", rootChronicleURI,
      ]);
      this.clockEvent(1, `prologues.connect`, `Narrating and connecting ${prologues.length
          } prologues and root chronicle`, `<${rootChronicleURI}>`);
      const connections = await Promise.all(prologues.map(this._connectChronicleNarratePrologue));
      this.warnEvent(1, () => [
        `Acquired active connections for all revelation prologue chronicles:`,
        ...[].concat(...connections.map(connection =>
            [`\n\t${connection.getName()}:`, ...dumpObject(connection.getStatus())]))
      ]);
      const rootConnection = connections.find(connection =>
          (connection.getChronicleURI() === rootChronicleURI));
      return { connections, rootConnection };
    } catch (error) {
      throw this.wrapErrorEvent(error, 1, new Error(`narratePrologue`),
          "\n\tprologue revelation:", prologueRevelation,
          "\n\tprologues:", ...dumpObject(prologues));
    }
  }

  async _determineRevelationPrologues (prologueRevelation: Object, rootChronicleURI: any) {
    const ret = [];
    let rootChronicleURISeen = false;
    try {
      for (const [partitionURI, info] of (Object.entries(
          (await lazy(prologueRevelation.partitionInfos)) || {}))) {
        const chronicleURI = naiveURI.createChronicleURI(partitionURI);
        ret.push({ partitionURI: chronicleURI, info: await lazy(info) });
        if (chronicleURI === rootChronicleURI) rootChronicleURISeen = true;
      }
      if (rootChronicleURI && !rootChronicleURISeen) {
        ret.push({
          partitionURI: rootChronicleURI,
          info: {
            commandCount: 0, truthCount: 0,
            logs: { commandQueue: [], truthLog: [] },
          },
        });
      }
      if (!ret.length) {
        throw new Error(`Revelation prologue is missing an entry point${
            ""} (last of the prologue.partitionInfos or prologue.rootChronicleURI)`);
      }
      return ret;
    } catch (error) {
      throw this.wrapErrorEvent(error, 1, new Error(`determineRevelationPrologues`),
          "\n\tprologue revelation:", ...dumpObject(prologueRevelation),
      );
    }
  }

  _connectChronicleNarratePrologue = async ({ partitionURI, info }: any) => {
    if ((await lazy(info.commandId)) >= 0 || ((await lazy(info.commandCount)) > 0)) {
      throw new Error("Command queues in revelation are not supported yet");
    }
    // Acquire connection without remote narration to determine the current last authorized event
    // so that we can narrate any content in the prologue before any remote activity.
    this.clockEvent(1, "prologue.acquire", `Acquiring connection <${partitionURI}>`);
    const connection = this.discourse
        .acquireConnection(naiveURI.createChronicleURI(partitionURI), {
          subscribeEvents: false, narrateOptions: { remote: false },
        });
    connection.clockEvent(1, "prologue.activate", "Activating connection");
    await connection.asActiveConnection();
    let prologueTruthCount = await lazy(info.truthCount);
    if (!Number.isInteger(prologueTruthCount)) {
      // Migration code for eventId deprecation.
      const lastEventId = await lazy(info.eventId);
      prologueTruthCount = lastEventId !== undefined ? lastEventId + 1 : 0;
    }
    const eventIdEnd = connection.getFirstUnusedTruthEventId() || 0;
    const shouldChroniclePrologue = ((prologueTruthCount || 0) > eventIdEnd);
    if (shouldChroniclePrologue) {
      connection.clockEvent(1, `prologue.chronicle`,
          `Chronicling truths, medias and bvobs from revelation`);
      // If no event logs are replayed, we don't need to precache the bvobs either, so we delay
      // loading them up to this point.
      await (lazy(this.bvobInfos) || (this.bvobInfos = this._getBvobInfos()));
      const logs = await lazy(info.logs);
      let truthLog = await lazy(logs.truthLog);
      if (!truthLog || !truthLog.length) {
        // Migration code for eventLog deprecation.
        const eventLog = await lazy(logs.eventLog);
        if (eventLog && eventLog.length) truthLog = eventLog;
      }
      const commandQueue = await lazy(logs.commandQueue);
      if (commandQueue && commandQueue.length) {
        throw new Error("commandQueue revelation not implemented yet");
      }
      const latestMediaInfos = await lazy(logs.latestMediaInfos); // only used for validation
      const upgradedEventLog = truthLog.map(event => upgradeEventTo0Dot2(connection, event));
      const chronicling = connection.chronicleEvents(upgradedEventLog, {
        name: `prologue truths for '${connection.getName()}'`,
        isTruth: true,
        eventIdBegin: eventIdEnd,
        retrieveMediaBuffer (mediaInfo: Object) {
          const latestInfo = mediaInfo.mediaVRL && latestMediaInfos[mediaInfo.mediaVRL.rawId()];
          if (!latestInfo || (mediaInfo.contentHash !== latestInfo.mediaInfo.contentHash)) {
            // Bvob wasn't found in cache and the contentHash doesn't match the latest known
            // contentHash for the requested media. The request for the latest bvob should come
            // later: Return undefined to silently ignore this request.
            return undefined;
          }
          // Otherwise this is the request for last known bvob, which should have been precached.
          throw new Error(`Cannot find the latest bvob of media "${mediaInfo.name
              }" during prologue narration, with bvob id "${mediaInfo.contentHash}" `);
        }
      });
      connection.clockEvent(1, `prologue.chronicle.await.local.results`,
          `Waiting for chronicle events to resolve locally`);
      for (const result of chronicling.eventResults) await result.getComposedEvent();
    }
    // Initiate remote narration.
    connection.clockEvent(1, `prologue.narrate`,
        `Starting full remote narration and subscribing for events`);
    const remoteNarration = connection.narrateEventLog(
        { subscribeEvents: true, eventIdBegin: eventIdEnd });
    if (!shouldChroniclePrologue && !(eventIdEnd > 0)) {
      connection.clockEvent(1, `prologue.narrate.await`, `Waiting for remote narration`);
      await remoteNarration;
    }
    connection.clockEvent(1, `prologue.acquire.done`);
    return connection;
  }

  // Permanently precache revelation bvobs by setting its refcount to 1.
  static revelationBvobInitialPersistRefCount = 1;

  async _getBvobInfos () {
    const readRevelationBvobContent = async (contentHash: string) => {
      const bvobBuffers = {
        ...await lazy(this.prologueRevelation.bvobBuffers),
        ...await lazy(this.prologueRevelation.blobBuffers), // deprecated
      };
      if (bvobBuffers[contentHash] === undefined) {
        this.errorEvent("Could not locate precached content for bvob", contentHash,
            "from revelation bvobBuffers", ...dumpObject(bvobBuffers));
        return undefined;
      }
      const container = await lazy(bvobBuffers[contentHash]);
      if (container.base64 !== undefined) return byteArrayFromBase64(container.base64).buffer;
      return container;
    };
    const bvobInfos = {
      ...((await lazy(this.prologueRevelation.bvobInfos)) || {}),
      ...((await lazy(this.prologueRevelation.blobInfos)) || {}), // deprecated
    };
    for (const [contentHash, bvobInfoMaybe] of Object.entries(bvobInfos || {})) {
      const bvobInfo = await lazy(bvobInfoMaybe);
      if (bvobInfo.persistRefCount !== 0) {
        await this.scribe.preCacheBvob(contentHash, bvobInfo, readRevelationBvobContent,
            Gateway.revelationBvobInitialPersistRefCount);
      }
    }
    return (this.bvobInfos = bvobInfos);
  }
}
