// @flow

import "@babel/polyfill";

import { Map as ImmutableMap } from "immutable";

import { createPartitionURI } from "~/raem/ValaaURI";
import createRootReducer from "~/raem/tools/createRootReducer";
import createValidateActionMiddleware from "~/raem/redux/middleware/validateAction";
import createProcessCommandIdMiddleware from "~/raem/redux/middleware/processCommandId";
import createProcessCommandVersionMiddleware from
    "~/raem/redux/middleware/processCommandVersion";
import { createBardMiddleware } from "~/raem/redux/Bard";
import Corpus from "~/raem/Corpus";

import { AuthorityNexus, FalseProphet, Oracle, Prophet, Scribe } from "~/prophet";

import ValaaEngine from "~/engine/ValaaEngine";
import EngineContentAPI from "~/engine/EngineContentAPI";
import extendValaaSpaceWithEngine from "~/engine/ValaaSpace";

import InspireView from "~/inspire/InspireView";

import { registerVidgets } from "~/inspire/ui";
import type { Revelation } from "~/inspire/Revelation";
import extendValaaSpaceWithInspire from "~/inspire/ValaaSpace";

import { arrayBufferFromBase64 } from "~/tools/base64";
import { dumpObject, invariantify, LogEventGenerator, valaaUUID } from "~/tools";

const DEFAULT_ACTION_VERSION = process.env.DEFAULT_ACTION_VERSION || "0.1";

export default class InspireGateway extends LogEventGenerator {

  constructor (options: Object) {
    super(options);
    this.revelationSiteRootPath = options.revelationSiteRootPath || "";
  }

  callRevelation (Type: Function | any) {
    if (typeof Type !== "function") return Type;
    return new Type({ logger: this.getLogger() });
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

      this.setDebugLevel(this.gatewayRevelation.verbosity || 0);

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
          this.corpus, this.oracle);

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
          ...(!this.getDebugLevel() ? [] : [", with:",
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
      ret[viewName] = createView({ engine, name: `${viewConfig.name} View` })
          .attach(viewConfig);
      this.warnEvent(`Opened View ${viewName}`,
          ...(!this.getDebugLevel() ? [] : [", with:",
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
          ...(!this.getDebugLevel() ? [] : [", with:",
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
      await scribe.initialize();

      this.warnEvent(`Proselytized Scribe '${scribe.debugId()}'`,
          ...(!this.getDebugLevel() ? [] : [", with:",
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
        debugLevel: 1,
        authorityNexus,
        ...await gatewayRevelation.oracle,
      };
      const oracle = new Oracle(oracleOptions);
      this.warnEvent(`Created Oracle ${oracle.debugId()}`,
          ...(!this.getDebugLevel() ? [] : [", with:",
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
      logEventer: this,
      ...await gatewayRevelation.reducer,
    };
    const { schema, validators, mainReduce, subReduce } = createRootReducer(reducerOptions);

    // FIXME(iridian): Create the deterministic-id schema. Now random.
    const previousId = valaaUUID();
    const defaultCommandVersion = DEFAULT_ACTION_VERSION;
    const middlewares = [
      createProcessCommandVersionMiddleware(defaultCommandVersion),
      createProcessCommandIdMiddleware(previousId, schema),
      createValidateActionMiddleware(validators),
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
        commandCountCallback: this._updateCommandCount,
        ...await gatewayRevelation.falseProphet,
      };
      const falseProphet = new FalseProphet(falseProphetOptions);
      this.warnEvent(`Proselytized FalseProphet ${falseProphet.debugId()}`,
          ...(!this.getDebugLevel() ? [] : [", with:",
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
      this.nexus.addAuthorityConfig(authorityConfig);
    }
    for (const MediaDecoder_: any of Object.values(plugin.mediaDecoders || {})) {
      this.oracle.getDecoderArray().addDecoder(this.callRevelation(MediaDecoder_));
    }
  }

  async _narratePrologues (prologueRevelation: Object) {
    let prologues;
    try {
      this.warnEvent(`Narrating revelation prologues`);
      prologues = await this._loadRevelationEntryPartitionAndPrologues(prologueRevelation);
      this.warnEvent(`Narrated revelation with ${prologues.length} prologues`,
          "\n\tprologue partitions:",
              `'${prologues.map(({ partitionURI }) => String(partitionURI)).join("', '")}'`);
      const ret = await Promise.all(prologues.map(this._connectChronicleAndNarratePrologue));
      this.warnEvent(`Acquired active connections for all revelation prologue partitions:`,
          "\n\tconnections:", ...dumpObject(ret));
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
          info: { commandId: -1, eventId: -1, logs: { commandQueue: [], eventLog: [] } },
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
    if ((await info.commandId) >= 0) {
      throw new Error("Command queues in revelation are not supported yet");
    }
    // Acquire connection without remote narration to determine the current last authorized event
    // so that we can narrate any content in the prologue before any remote activity.
    const connection = await this.falseProphet
        .acquirePartitionConnection(partitionURI, { subscribe: false, remote: false })
        .getSyncedConnection();
    const lastPrologueEventId = await info.eventId;
    const firstUnusedEventId = connection.getFirstUnusedTruthEventId() || 0;
    const shouldChroniclePrologue = (lastPrologueEventId !== undefined)
        && (lastPrologueEventId >= firstUnusedEventId);
    if (shouldChroniclePrologue) {
      // If no event logs are replayed, we don't need to precache the bvobs either, so we delay
      // loading them up to this point.
      await (this.bvobInfos || (this.bvobInfos = this._getBvobInfos()));
      const logs = await info.logs;
      const eventLog = await logs.eventLog;
      const commandQueue = await logs.commandQueue;
      if (commandQueue && commandQueue.length) {
        throw new Error("commandQueue revelation not implemented yet");
      }
      const latestMediaInfos = await logs.latestMediaInfos;
      const chronicling = await connection.chronicleEventLog(eventLog, {
        name: `prologue event log for '${connection.getName()}'`,
        preAuthorized: true,
        firstEventId: firstUnusedEventId,
        retrieveMediaBuffer (mediaInfo: Object) {
          const latestInfo = latestMediaInfos[mediaInfo.mediaId];
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
      await Promise.all(chronicling.eventResults.map(result => result.getLocallyReceivedEvent()));
    }
    // Initiate remote narration.
    const remoteNarration = connection.narrateEventLog();
    if (!shouldChroniclePrologue && !(firstUnusedEventId > 0)) await remoteNarration;
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
