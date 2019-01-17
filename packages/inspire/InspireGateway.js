// @flow

import "@babel/polyfill";

import { Map as ImmutableMap } from "immutable";

import * as valosRaem from "~/raem";
import * as valosTools from "~/tools";
import * as valosScript from "~/script";
import * as valosProphet from "~/prophet";
import * as valosEngine from "~/engine";
import * as valosInspire from "~/inspire";

import { createPartitionURI } from "~/raem/ValaaURI";
import createRootReducer from "~/raem/tools/createRootReducer";
import createValidateEventMiddleware from "~/raem/redux/middleware/validateEvent";
import createProcessCommandIdMiddleware from "~/raem/redux/middleware/processCommandId";
import { createBardMiddleware } from "~/raem/redux/Bard";
import Corpus from "~/raem/Corpus";

import upgradeEventTo0Dot2 from "~/prophet/tools/event-version-0.2/upgradeEventTo0Dot2";
import EVENT_VERSION from "~/prophet/tools/EVENT_VERSION";

import ValaaEngine from "~/engine/ValaaEngine";
import EngineContentAPI from "~/engine/EngineContentAPI";
import extendValaaSpaceWithEngine from "~/engine/ValaaSpace";

import InspireView from "~/inspire/InspireView";

import { registerVidgets } from "~/inspire/ui";
import type { Revelation } from "~/inspire/Revelation";
import extendValaaSpaceWithInspire from "~/inspire/ValaaSpace";

import { arrayBufferFromBase64 } from "~/tools/base64";

const { AuthorityNexus, FalseProphet, Oracle, Prophet, Scribe } = valosProphet;
const { dumpObject, inBrowser, invariantify, LogEventGenerator, thenChainEagerly } = valosTools;

export default class InspireGateway extends LogEventGenerator {
  constructor (options: Object) {
    super(options);
    if (options.siteRoot === undefined) {
      throw new Error("Required gateway.options.siteRoot is undefined");
    }
    if (options.revelationRoot === undefined) {
      throw new Error("Required gateway.options.revelationRoot is undefined");
    }
    this.siteRoot = options.siteRoot;
    this.revelationRoot = options.revelationRoot;
  }

  callRevelation (Type: Function | any) {
    if (typeof Type !== "function") return Type;
    return new Type({ gateway: this, logger: this.getLogger() });
  }

  static moduleMatcherString = "^((@[^@/]+\\/)?([^/]+))(\\/(.*))?$";
  static moduleMatcher = new RegExp(InspireGateway.moduleMatcherString);

  /**
   * Valaa.gateway.require is the entry point for ValOS fabric library
   * imports from inside plugins.
   *
   * @param {string} module
   * @returns
   * @memberof InspireGateway
   */
  require (module: string) {
    // TODO(iridian, 2018-12): fabric library version semver compatibility checking against plugin
    //                package.json dependencies
    // TODO(iridian, 2018-12): plugin-sourced library registration system for webpack environments
    // TODO(iridian, 2018-12): correlate require semantics with import semantics
    // TODO(iridian, 2018-12): evaluate making require contents available as the default require
    //                         from within ValaaSpace

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
    if (!inBrowser()) return require(module);

    const parts = InspireGateway.moduleMatcher.exec(module);
    if (!parts) {
      throw new Error(`Invalid Valaa.require module: "${module
          }" doesn't match regex /${InspireGateway.moduleMatcherString}/)`);
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
      else if (library === "prophet") ret = valosProphet;
      else if (library === "raem") ret = valosRaem;
      else if (library === "script") ret = valosScript;
      else if (library === "tools") ret = valosTools;
      else throw new Error(`Unrecognized Valaa.require @valos library: '${library}'`);
    } else if (scope) throw new Error(`Unrecognized Valaa.require scope: '${scope}'`);
    else throw new Error(`Unrecognized Valaa.require library: '${library}'`);
    if (subPath) {
      throw new Error(`Unsupported Valaa.require sub-path: "${subPath
          }" (only top level library require's supported for now)`);
    }
    return ret;
  }

  async initialize (revelation: Revelation) {
    try {
      // Process the initially served landing page and extract the initial Valaa configuration
      // ('revelation') from it. The revelation might be device/locality specific.
      // The revelation might contain initial event log snapshots for select partitions. These
      // event logs might be provided by the landing page provider and might contain relevant
      // partition for showing the front page; alternatively the revelation might be served by the
      // local service worker which intercepted the landing page network request and might contain
      // full snapshots of all partitions that were active during previous session, allowing full
      // offline functionality. Alternatively the service worker can provide the event logs through
      // indexeddb and keep the landing page revelation minimal; whatever is most efficient.
      this.revelation = await this._interpretRevelation(revelation);
      this.gatewayRevelation = await this.revelation.gateway;
      if (this.gatewayRevelation.name) this.setName(await this.gatewayRevelation.name);

      this.setVerbosity(this.gatewayRevelation.verbosity || 0);

      this.nexus = await this._establishAuthorityNexus(this.gatewayRevelation);

      // Create the stream router ('oracle') which uses scribe as its direct upstream, but which
      // manages the remote authority connections.
      this.oracle = await this._summonOracle(this.gatewayRevelation, this.nexus);

      // Create a connector (the 'scribe') to the locally backed event log / bvob indexeddb cache
      // ('scriptures') based on the revelation.
      this.scribe = await this._proselytizeScribe(this.gatewayRevelation, this.oracle);

      this.corpus = await this._incorporateCorpus(this.gatewayRevelation);

      // Create the the main in-memory false prophet using the stream router as its upstream.
      this.falseProphet = await this._proselytizeFalseProphet(this.gatewayRevelation,
          this.corpus, this.scribe);

      await this.attachPlugins(await this.gatewayRevelation.plugins);

      this.prologueRevelation = await this.revelation.prologue;

      // Locate entry point event log (prologue), make it optimally available through scribe,
      // narrate it with false prophet and get the false prophet connection for it.
      this.prologueConnections = await this._narratePrologues(this.prologueRevelation,
          this.scribe, this.falseProphet);

      this.entryPartitionConnection =
          this.prologueConnections[this.prologueConnections.length - 1];

      registerVidgets();
      this.warnEvent(`initialize(): registered builtin Inspire vidgets`);
      this.warnEvent("InspireGateway initialized, with revelation", ...dumpObject(revelation));
    } catch (error) {
      throw this.wrapErrorEvent(error, "initialize", "\n\tthis:", ...dumpObject(this));
    }
  }

  getRootPartitionURI () {
    return String(this.entryPartitionConnection.getPartitionURI());
  }

  createAndConnectViewsToDOM (viewConfigs: {
    [string]: { name: string, size: Object, container: Object, rootId: string, rootLensURI: any }
  }, createView = (options) => new InspireView(options)) {
    const ret = {};
    for (const [viewName, viewConfig: Object] of Object.entries(viewConfigs)) {
      this.warnEvent(`createView({ name: '${viewConfig.name}', ... })`, ...dumpObject(viewConfig));
      const engineOptions = {
        name: `${viewConfig.name} Engine`,
        logger: this.getLogger(),
        prophet: this.falseProphet,
        revelation: this.revelation,
      };
      const engine = new ValaaEngine(engineOptions);
      this.warnEvent(`Started ValaaEngine ${engine.debugId()}`,
          ...(!this.getVerbosity() ? [] : [", with:",
            "\n\tengineOptions:", ...dumpObject(engineOptions),
            "\n\tengine:", ...dumpObject(engine),
          ]));

      const rootScope = engine.getRootScope();
      const hostDescriptors = engine.getHostObjectDescriptors();
      extendValaaSpaceWithEngine(rootScope, hostDescriptors, engine.discourse.getSchema());
      if (!viewConfig.defaultAuthorityURI) {
        extendValaaSpaceWithInspire(rootScope, hostDescriptors);
      } else {
        // FIXME(iridian): Implement this.schemes - still missing.
        const defaultAuthorityConfig = this.schemes[viewConfig.defaultAuthorityURI];
        invariantify(defaultAuthorityConfig,
            `defaultAuthorityConfig missing when looking for default authority ${
                  String(viewConfig.defaultAuthorityURI)}`);
        extendValaaSpaceWithInspire(rootScope, hostDescriptors, defaultAuthorityConfig, engine);
      }
      rootScope.Valaa.gateway = this;
      rootScope.Valaa.identity = engine.getIdentityManager();

      ret[viewName] = thenChainEagerly(createView({ engine, name: `${viewConfig.name} View` }), [
        view => view.attach(viewConfig),
        attachedView => (ret[viewName] = attachedView),
      ]);
      this.warnEvent(`Opened View ${viewName}`,
          ...(!this.getVerbosity() ? [] : [", with:",
            "\n\tviewConfig:", ...dumpObject(viewConfig),
            "\n\tview:", ...dumpObject(ret[viewName]),
          ]));
    }
    return ret;
  }

  /**
   * Processes the landing page and extracts the revelation from it.
   *
   * @param {Object} rawRevelation
   * @returns
   *
   * @memberof InspireGateway
   */
  async _interpretRevelation (revelation: Revelation): Object {
    try {
      this.warnEvent(`Interpreted revelation`, ...dumpObject(revelation));
      return revelation;
    } catch (error) {
      throw this.wrapErrorEvent(error, "interpretRevelation", "\n\trevelation:", ...dumpObject(revelation));
    }
  }

  async _establishAuthorityNexus (gatewayRevelation: Object) {
    let nexusOptions;
    try {
      nexusOptions = {
        name: "Inspire AuthorityNexus",
        authorityConfigs: await gatewayRevelation.authorityConfigs,
      };
      const nexus = new AuthorityNexus(nexusOptions);
      this.warnEvent(`Established AuthorityNexus '${nexus.debugId()}'`,
          ...(!this.getVerbosity() ? [] : [", with:",
            "\n\toptions:", ...dumpObject(nexusOptions),
            "\n\tnexus:", ...dumpObject(nexus),
          ]));
      return nexus;
    } catch (error) {
      throw this.wrapErrorEvent(error, "establishAuthorityNexus",
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
        ...await gatewayRevelation.scribe,
      };
      const scribe = await new Scribe(scribeOptions);
      await scribe.initiate();

      this.warnEvent(`Proselytized Scribe '${scribe.debugId()}'`,
          ...(!this.getVerbosity() ? [] : [", with:",
            "\n\tscribeOptions:", ...dumpObject(scribeOptions),
            "\n\tscribe:", ...dumpObject(scribe),
          ]));
      return scribe;
    } catch (error) {
      throw this.wrapErrorEvent(error, "proselytizeScribe",
          "\n\tscribeOptions:", ...dumpObject(scribeOptions));
    }
  }

  async _summonOracle (gatewayRevelation: Object, authorityNexus: AuthorityNexus):
      Promise<Prophet> {
    let oracleOptions;
    try {
      oracleOptions = {
        name: "Inspire Oracle",
        logger: this.getLogger(),
        authorityNexus,
        ...await gatewayRevelation.oracle,
      };
      const oracle = new Oracle(oracleOptions);
      this.warnEvent(`Proselytized Oracle ${oracle.debugId()}`,
          ...(!this.getVerbosity() ? [] : [", with:",
            "\n\toracleOptions:", ...dumpObject(oracleOptions),
            "\n\toracle:", ...dumpObject(oracle),
          ]));
      return oracle;
    } catch (error) {
      throw this.wrapErrorEvent(error, "summonOracle",
          "\n\toracleOptions:", ...dumpObject(oracleOptions),
          "\n\tauthorityNexus:", ...dumpObject(authorityNexus));
    }
  }

  async _incorporateCorpus (gatewayRevelation: Object) {
    const name = "Inspire Corpus";
    const reducerOptions = {
      ...EngineContentAPI, // schema, validators, reducers
      eventLogger: this,
      ...await gatewayRevelation.reducer,
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
      ...await gatewayRevelation.corpus,
    };
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

  async _proselytizeFalseProphet (gatewayRevelation: Object, corpus: Corpus, upstream: Prophet):
      Promise<Prophet> {
    let falseProphetOptions;
    try {
      this._commandCountListeners = new Map();
      falseProphetOptions = {
        name: "Inspire FalseProphet",
        corpus,
        upstream,
        schema: EngineContentAPI.schema,
        logger: this.getLogger(),
        onCommandCountUpdate: this._updateCommandCount,
        ...await gatewayRevelation.falseProphet,
      };
      const falseProphet = new FalseProphet(falseProphetOptions);
      this.warnEvent(`Proselytized FalseProphet ${falseProphet.debugId()}`,
          ...(!this.getVerbosity() ? [] : [", with:",
            "\n\tfalseProphetOptions:", ...dumpObject(falseProphetOptions),
            "\n\tfalseProphet:", ...dumpObject(falseProphet),
          ]),
      );
      return falseProphet;
    } catch (error) {
      throw this.wrapErrorEvent(error, "proselytizeFalseProphet",
          "\n\tfalseProphetOptions:", ...dumpObject(falseProphetOptions),
          "\n\tupstream:", ...dumpObject(upstream));
    }
  }

  _updateCommandCount = (totalCount: number, partitionCommandCounts: Object) => {
    this._totalCommandCount = totalCount;
    this._partitionCommandCounts = partitionCommandCounts;
    this._commandCountListeners.forEach(listener => listener(totalCount, partitionCommandCounts));
  }

  setCommandCountListener (component: Object,
      callback: (totalCount: number, partitionCommandCounts: Object) => void) {
    if (!callback) this._commandCountListeners.delete(component);
    else {
      this._commandCountListeners.set(component, callback);
      callback(this._totalCommandCount, this._partitionCommandCounts);
    }
  }

  async attachPlugin (plugin: Promise<Object>) { return this.attachPlugins([plugin]); }

  async attachPlugins (plugins_: (Promise<Object> | Object)[]) {
    const plugins = await Promise.all(plugins_);
    const pluginLookup = {};
    for (const plugin of plugins) {
      if (pluginLookup[plugin.name]) {
        this.errorEvent(`Plugin '${plugin.name}' already being added:`,
            pluginLookup[plugin.name], "\n\tskipping adding a new duplicate:", ...dumpObject(plugin));
      }
      pluginLookup[plugin.name] = plugin;
    }
    this.warnEvent(`Attaching ${plugins.length} plugins:`, ...dumpObject(pluginLookup));
    for (const plugin of plugins) this._attachPlugin(plugin);
  }

  _attachPlugin (plugin: Object) {
    for (const schemeModule of Object.values(plugin.schemeModules || {})) {
      this.nexus.addSchemeModule(this.callRevelation(schemeModule));
    }
    for (const authorityConfig of Object.values(plugin.authorityConfigs || {})) {
      this.nexus.addAuthorityPreConfig(authorityConfig);
    }
    for (const MediaDecoder_: any of Object.values(plugin.mediaDecoders || {})) {
      this.oracle.getDecoderArray().addDecoder(this.callRevelation(MediaDecoder_));
    }
  }

  async _narratePrologues (prologueRevelation: Object) {
    let prologues;
    try {
      this.warnEvent(`Extracting revelation prologues`);
      prologues = await this._loadRevelationEntryPartitionAndPrologues(prologueRevelation);
      this.warnEvent(`Extracted ${prologues.length} prologues from the revelation`,
          "\n\tprologue partitions:",
              `'${prologues.map(({ partitionURI }) => String(partitionURI)).join("', '")}'`);
      const ret = await Promise.all(prologues.map(this._connectChronicleAndNarratePrologue));
      this.warnEvent(`Acquired active connections for all revelation prologue partitions:`,
          ...[].concat(...ret.map(connection =>
            [`\n\t${connection.getName()}:`, connection.getStatus()])));
      return ret;
    } catch (error) {
      throw this.wrapErrorEvent(error, "narratePrologue",
          "\n\tprologue revelation:", prologueRevelation,
          "\n\tprologues:", ...dumpObject(prologues));
    }
  }

  async _loadRevelationEntryPartitionAndPrologues (prologueRevelation: Object) {
    const ret = [];
    try {
      for (const [uri, info] of (Object.entries((await prologueRevelation.partitionInfos) || {}))) {
        ret.push({
          partitionURI: createPartitionURI(uri),
          info: await info,
        });
      }
      let partitionURI;
      if (prologueRevelation.endpoint) {
        const endpoint = await prologueRevelation.endpoint;
        const endpoints = (await prologueRevelation.endpoints) || {};
        if (!endpoints[endpoint]) {
          throw new Error(`prologue.endpoint '${endpoint}' not found in prologue.endpoints`);
        }
        partitionURI = createPartitionURI(await endpoints[endpoint]);
      } else if (prologueRevelation.rootPartitionURI) {
        partitionURI = createPartitionURI(await prologueRevelation.rootPartitionURI);
      }
      if (partitionURI) {
        ret.push({
          partitionURI,
          isNewPartition: false,
          info: {
            commandCount: 0, truthCount: 0,
            logs: { commandQueue: [], truthLog: [] },
          },
        });
      }
      if (!ret.length) {
        throw new Error(`Revelation prologue is missing entry point${
            ""} (either prologue.endpoint or prologue.rootPartitionURI)`);
      }
      return ret;
    } catch (error) {
      throw this.wrapErrorEvent(error, "loadRevelationEntryPartitionAndPrologues",
          "\n\tprologue revelation:", ...dumpObject(prologueRevelation),
      );
    }
  }

  _connectChronicleAndNarratePrologue = async ({ partitionURI, info }: any) => {
    if ((await info.commandId) >= 0 || ((await info.commandCount) > 0)) {
      throw new Error("Command queues in revelation are not supported yet");
    }
    // Acquire connection without remote narration to determine the current last authorized event
    // so that we can narrate any content in the prologue before any remote activity.
    const connection = await this.falseProphet
        .acquirePartitionConnection(partitionURI, {
          subscribeEvents: false, narrateOptions: { remote: false },
        })
        .getActiveConnection();
    let prologueTruthCount = await info.truthCount;
    if (!Number.isInteger(prologueTruthCount)) {
      // Migration code for eventId deprecation.
      const lastEventId = await info.eventId;
      prologueTruthCount = lastEventId !== undefined ? lastEventId + 1 : 0;
    }
    const eventIdEnd = connection.getFirstUnusedTruthEventId() || 0;
    const shouldChroniclePrologue = ((prologueTruthCount || 0) > eventIdEnd);
    if (shouldChroniclePrologue) {
      // If no event logs are replayed, we don't need to precache the bvobs either, so we delay
      // loading them up to this point.
      await (this.bvobInfos || (this.bvobInfos = this._getBvobInfos()));
      const logs = await info.logs;
      let truthLog = await logs.truthLog;
      if (!truthLog || !truthLog.length) {
        // Migration code for eventLog deprecation.
        const eventLog = await logs.eventLog;
        if (eventLog && eventLog.length) truthLog = eventLog;
      }
      const commandQueue = await logs.commandQueue;
      if (commandQueue && commandQueue.length) {
        throw new Error("commandQueue revelation not implemented yet");
      }
      const latestMediaInfos = await logs.latestMediaInfos; // only used for validation for now
      const upgradedEventLog = truthLog.map(event => upgradeEventTo0Dot2(connection, event));
      const chronicling = connection.chronicleEvents(upgradedEventLog, {
        name: `prologue truths for '${connection.getName()}'`,
        isTruth: true,
        eventIdBegin: eventIdEnd,
        retrieveMediaBuffer (mediaInfo: Object) {
          const latestInfo = mediaInfo.mediaRef && latestMediaInfos[mediaInfo.mediaRef.rawId()];
          if (!latestInfo ||
              (mediaInfo.bvobId !== (latestInfo.mediaInfo.bvobId || latestInfo.mediaInfo.blobId))) {
            // Bvob wasn't found in cache and the bvobId doesn't match the latest known bvobId for
            // the requested media. The request for the latest bvob should come later:
            // Return undefined to silently ignore this request.
            return undefined;
          }
          // Otherwise this is the request for last known bvob, which should have been precached.
          throw new Error(`Cannot find the latest bvob of media "${mediaInfo.name
              }" during prologue narration, with bvob id "${mediaInfo.bvobId}" `);
        }
      });
      for (const result of chronicling.eventResults) await result.getLocalEvent();
    }
    // Initiate remote narration.
    const remoteNarration = connection.narrateEventLog({ subscribeEvents: true });
    if (!shouldChroniclePrologue && !(eventIdEnd > 0)) await remoteNarration;
    return connection;
  }

  // Permanently precache revelation bvobs by setting its refcount to 1.
  static revelationBvobInitialPersistRefCount = 1;

  async _getBvobInfos () {
    const readRevelationBvobContent = async (bvobId: string) => {
      const bvobBuffers = {
        ...await this.prologueRevelation.bvobBuffers,
        ...await this.prologueRevelation.blobBuffers, // deprecated
      };
      if (typeof bvobBuffers[bvobId] === "undefined") {
        this.errorEvent("Could not locate precached content for bvob", bvobId,
            "from revelation bvobBuffers", ...dumpObject(bvobBuffers));
        return undefined;
      }
      const container = await bvobBuffers[bvobId];
      if (typeof container.base64 !== "undefined") return arrayBufferFromBase64(container.base64);
      return container;
    };
    const bvobInfos = {
      ...((await this.prologueRevelation.bvobInfos) || {}),
      ...((await this.prologueRevelation.blobInfos) || {}), // deprecated
    };
    for (const [bvobId, bvobInfoMaybe] of Object.entries(bvobInfos || {})) {
      const bvobInfo = await bvobInfoMaybe;
      if (bvobInfo.persistRefCount !== 0) {
        await this.scribe.preCacheBvob(bvobId, bvobInfo, readRevelationBvobContent,
            InspireGateway.revelationBvobInitialPersistRefCount);
      }
    }
    return (this.bvobInfos = bvobInfos);
  }
}
