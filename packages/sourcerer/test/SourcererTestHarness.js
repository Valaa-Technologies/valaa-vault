// @flow

import { OrderedMap } from "immutable";
import { created, EventBase } from "~/raem/events";

import { naiveURI } from "~/raem/ValaaURI";

import { createCorpus } from "~/raem/test/RAEMTestHarness";

import ScriptTestHarness, { createScriptTestHarness } from "~/script/test/ScriptTestHarness";

import {
  AuthorityNexus, FalseProphet, FalseProphetDiscourse, Oracle, Connection, Sourcerer,
  Scribe, Follower,
} from "~/sourcerer";
import { obtainAspect } from "~/sourcerer/tools/EventAspects";
import EVENT_VERSION from "~/sourcerer/tools/EVENT_VERSION";

import SourcererTestAPI from "~/sourcerer/test/SourcererTestAPI";
import createValaaTestScheme, { TestSourcerer, TestConnection }
    from "~/sourcerer/test/scheme-valaa-test";
import createValaaLocalScheme from "~/sourcerer/schemeModules/valaa-local";
import createValaaMemoryScheme from "~/sourcerer/schemeModules/valaa-memory";
import createValaaTransientScheme from "~/sourcerer/schemeModules/valaa-transient";

import * as ValoscriptDecoders from "~/script/mediaDecoders";
import * as ToolsDecoders from "~/tools/mediaDecoders";

import { thenChainEagerly } from "~/tools/thenChainEagerly";
import { getDatabaseAPI } from "~/tools/indexedDB/getInMemoryDatabaseAPI";
import { openDB } from "~/tools/html5/InMemoryIndexedDBUtils";
import { dumpify, dumpObject, isPromise, wrapError } from "~/tools";

export const testAuthorityURI = "valaa-test:";
export const testPartitionURI = naiveURI.createPartitionURI(testAuthorityURI, "test_partition");

export function createSourcererTestHarness (options: Object, ...commandBlocks: any) {
  const wrap = new Error("During createSourcererHarness");
  return thenChainEagerly({
    name: "Sourcerer Test Harness", ContentAPI: SourcererTestAPI, TestHarness: SourcererTestHarness,
    ...options,
  }, [
    sourcererOptions => createScriptTestHarness(sourcererOptions),
    harness => {
      commandBlocks.forEach(commands => {
        harness.chronicleEvents(commands).eventResults.forEach((result, index) => {
          if (isPromise((result.getTruthEvent || result.getTruthStory).call(result))) {
            throw new Error(`command #${index} getTruthEvent resolves into a Promise.${
                ""} Use the asynchronous createSourcererOracleHarness instead.`);
          }
        });
      });
      return harness;
    }
  ], function errorOnCreateSourcererHarness (error) {
    throw wrapError(error, wrap,
        "\n\toptions:", ...dumpObject(options),
        "\n\tcommandBlocks:", ...dumpObject(commandBlocks));
  });
}

let dbIsolationAutoPrefix = 0;

export async function createSourcererOracleHarness (options: Object, ...commandBlocks: any) {
  const isPaired = !!options.pairedHarness;
  const combinedOptions = {
    name: `${isPaired ? "Paired " : ""}Sourcerer Oracle Harness`,
    ...options,
    oracle: {
      verbosity: options.verbosity || 0,
      testAuthorityConfig: {
        ...(!isPaired ? {} : options.pairedHarness.testAuthorityConfig),
        ...((options.oracle || {}).testAuthorityConfig || {}),
      },
      ...(options.oracle || {}),
    },
    scribe: {
      verbosity: options.verbosity || 0,
      databasePrefix: `${isPaired ? "paired" : "test"}-isolated-${++dbIsolationAutoPrefix}-`,
      ...(options.scribe || {}),
    },
  };

  const ret = await createSourcererTestHarness(combinedOptions);
  try {
    if (options.acquirePartitions) {
      const partitionURIs = options.acquirePartitions.map(
          partitionId => naiveURI.createPartitionURI("valaa-test:", partitionId));
      const connections = partitionURIs.map(uri =>
          ret.sourcerer.acquireConnection(uri).asActiveConnection());
      (await Promise.all(connections)).forEach(connection => {
        if (ret.sourcerer.getVerbosity() >= 1) {
          console.log("Connection fully active:", connection.debugId());
        }
      });
    }
    for (const commands of commandBlocks) {
      const results = ret.chronicleEvents(commands).eventResults;
      await Promise.all(results.map(
          combinedOptions.awaitResult || (result => result.getPersistedStory())));
    }
    return ret;
  } catch (error) {
    throw ret.wrapErrorEvent(error, new Error("During createSourcererOracleHarness"),
        "\n\toptions:", ...dumpObject(options),
        "\n\tcommandBlocks:", ...dumpObject(commandBlocks));
  }
}

export const createdTestPartitionEntity = created({
  id: ["test_partition"], typeName: "Entity",
  initialState: {
    name: "Automatic Test Partition Root",
    partitionAuthorityURI: "valaa-test:",
  },
});

export default class SourcererTestHarness extends ScriptTestHarness {
  constructor (options: Object) {
    super(options);
    this.nextCommandIdIndex = 1;
    this.oracleOptions = options.oracle;
    if (this.oracleOptions) this.testAuthorityConfig = this.oracleOptions.testAuthorityConfig;
    this.scribeOptions = options.scribe;
    this.cleanupScribe = () => (this.scribeOptions && clearAllScribeDatabases(this.scribe));
    this.falseProphetOptions = options.falseProphet;
    this.nexusOptions = options.nexus;
    this.testAuthorityURI = options.testAuthorityURI || testAuthorityURI;
    this.testPartitionURI = options.testPartitionURI
        || (options.testAuthorityURI
            && naiveURI.createPartitionURI(this.testAuthorityURI, "test_partition"))
        || testPartitionURI;
  }

  initialize () {
    let hasRemoteTestBackend;
    return thenChainEagerly(
      super.initialize(), [
        ...(!this.oracleOptions ? [
          () => createTestMockSourcerer({ isLocallyPersisted: false }),
        ] : [
          () => createOracle(this.oracleOptions, this.nexusOptions),
          oracle => (this.oracle = oracle),
        ]),
        ...(!this.scribeOptions ? [] : [
          upstream => createScribe(upstream, this.scribeOptions),
          scribe => (this.scribe = scribe),
        ]),
        upstream => this.sourcerer.setUpstream(upstream),
        () => {
          hasRemoteTestBackend = (this.testAuthorityConfig || {}).isRemoteAuthority;
          const testConnection = this.sourcerer.acquireConnection(
              this.testPartitionURI, { newPartition: !hasRemoteTestBackend });
          if (hasRemoteTestBackend) {
            // For remote test partitions with oracle we provide the root
            // entity as a response to the initial narrate request.
            const testBackend = this.tryGetTestAuthorityConnection(testConnection);
            testBackend.addNarrateResults({ eventIdBegin: 0 }, [{
              ...createdTestPartitionEntity,
              aspects: { version: "0.2", log: { index: 0 }, command: { id: "rid-0" } },
            }]);
          }
          return testConnection.asActiveConnection();
        },
        (testConnection) => (this.testConnection = testConnection),
          // For non-remotes we chronicle the root entity explicitly.
        () => {
          if (hasRemoteTestBackend) return undefined;
          const result = this.chronicleEvent(createdTestPartitionEntity, { isTruth: true });
          return result.getPremiereStory();
        },
      ],
      SourcererTestHarness.errorOn(new Error("SourcererTestHarness.initialize")),
    );
  }

  chronicleEvents (events: EventBase[], ...rest: any) {
    return this.chronicler.chronicleEvents(events, ...rest);
  }

  createCorpus (corpusOptions: Object = {}) {
    // Called by RAEMTestHarness.constructor (so before oracle/scribe are created)
    const corpus = super.createCorpus(corpusOptions);
    this.sourcerer = this.falseProphet = createFalseProphet({
      schema: this.schema, corpus, logger: this.getLogger(), verbosity: this.getVerbosity(),
      ...(this.falseProphetOptions || {}),
    });
    this.chronicler = this.sourcerer;
    return corpus;
  }

  createValker () {
    return (this.discourse = this.chronicler = new FalseProphetDiscourse({
      sourcerer: this.sourcerer,
      follower: new MockFollower(),
      schema: this.schema,
      verbosity: this.getVerbosity(),
      logger: this.getLogger(),
      packFromHost: value => (value instanceof OrderedMap ? value.get("id") : value),
      unpackToHost: value => {
        if (!(value instanceof OrderedMap)) return value;
        const id = value.get("id");
        if (!id || (id.typeof() !== "Resource")) return value;
        return id;
      },
      steppers: this.corpusOptions.steppers,
      assignCommandId: (command) => {
        obtainAspect(command, "command").id = `test-cid-${this.nextCommandIdIndex++}`;
      },
    }));
  }

  /**
   * Retrieves out-going test partition commands from the given source,
   * converts them into truths and then has corresponding active
   * connections in this harness receive them via their receiveTruths.
   *
   * @param {(Sourcerer | Connection)} source
   * @param {*} [{
   *     requireReceivingConnection = true,
   *     clearSourceUpstreamEntries = false,
   *     clearReceiverUpstreamEntries = false,
   *     authorizeTruth = (i => i),
   *   }={}]
   * @memberof SourcererTestHarness
   */
  async receiveTruthsFrom (source: Sourcerer | Connection, {
    verbosity = 0,
    requireReceivingConnection = true,
    clearSourceUpstreamEntries = false,
    clearReceiverUpstreamEntries = false,
    authorizeTruth = (i => i),
    asNarrateResults = false,
  } = {}) {
    for (const connection of ((source instanceof Connection)
        ? [source]
        : Object.values((source instanceof Sourcerer ? source : source.sourcerer)._connections))) {
      const testSourceBackend = this.tryGetTestAuthorityConnection(connection);
      if (!testSourceBackend) continue;
      const partitionURI = String(testSourceBackend.getPartitionURI());
      const receiver = this.oracle._connections[partitionURI];
      if (!receiver) {
        if (!requireReceivingConnection) continue;
        throw new Error(`Could not find a receiving connection for <${partitionURI}>`);
      }
      const receiverBackend = this.tryGetTestAuthorityConnection(receiver);
      if (!receiverBackend) {
        throw new Error(`Receving connection <${partitionURI
            }> has no TestConnection at the end of the chain`);
      }
      const truths = JSON.parse(JSON.stringify(
              (testSourceBackend._chroniclings || []).map(entry => entry.event)))
          .map(authorizeTruth);
      if (clearSourceUpstreamEntries) testSourceBackend._chroniclings = [];
      if (clearReceiverUpstreamEntries) receiverBackend._chroniclings = [];
      if (verbosity) {
        receiver.warnEvent("Receiving truths:", dumpify(truths, { indent: 2 }));
      }
      if (asNarrateResults) {
        receiverBackend.addNarrateResults({ eventIdBegin: truths[0].aspects.log.index }, truths);
      } else {
        await Promise.all(await receiverBackend.getReceiveTruths()(truths));
      }
    }
  }

  tryGetTestAuthorityConnection (connection): Connection {
    let ret = connection;
    for (; ret; ret = ret.getUpstreamConnection()) {
      if (ret instanceof TestConnection) break;
    }
    return ret;
  }

  createMockFollower () {
    const ret = MockFollower();
    ret.discourse = ret.sourcerer.addFollower(ret);
    return ret;
  }
}

const activeScribes = [];

export function createScribe (upstream: Sourcerer, options?: Object) {
  const ret = new Scribe({
    name: "Test Scribe",
    databaseAPI: getDatabaseAPI(),
    upstream,
    ...options,
  });
  activeScribes.push(ret);
  return ret.initiate();
}

export async function clearAllScribeDatabases () {
  for (const scribe of activeScribes.slice()) {
    await clearScribeDatabases(scribe);
  }
}

async function clearScribeDatabases (scribe: Scribe) {
  const index = activeScribes.findIndex(candidate => (candidate === scribe));
  if (index === -1) return;
  activeScribes.splice(index, 1);
  for (const idbw of [scribe._sharedDb, ...Object.values(scribe._connections).map(c => c._db)]) {
    if (!idbw) continue;
    const database = await openDB(idbw.databaseId);
    for (const table of database.objectStoreNames) {
      const transaction = database.transaction([table], "readwrite");
      const objectStore = transaction.objectStore(table);
      objectStore.clear();
      await transaction;
    }
  }
}

export function createOracle (options?: Object, nexusOptions?: Object) {
  const authorityNexus = new AuthorityNexus(nexusOptions);
  const ret = new Oracle({
    name: "Test Oracle",
    authorityNexus,
    ...options,
  });
  authorityNexus.addSchemeModule(createValaaLocalScheme({ logger: ret.getLogger() }));
  authorityNexus.addSchemeModule(createValaaTransientScheme({ logger: ret.getLogger() }));
  authorityNexus.addSchemeModule(createValaaMemoryScheme({ logger: ret.getLogger() }));
  authorityNexus.addSchemeModule(createValaaTestScheme({
    logger: ret.getLogger(), config: (options || {}).testAuthorityConfig,
  }));
  for (const Decoder: any of Object.values({ ...ToolsDecoders, ...ValoscriptDecoders })) {
    if (Decoder.mediaTypes) {
      ret.getDecoderArray().addDecoder(new Decoder({ logger: ret.getLogger() }));
    }
  }
  return ret;
}

export function createFalseProphet (options?: Object) {
  const corpus = (options && options.corpus) || createCorpus(SourcererTestAPI, {}, {});
  return new FalseProphet({
    name: "Test FalseProphet",
    corpus,
    ...options,
  });
}

export function createTestMockSourcerer (configOverrides: Object = {}) {
  return new TestSourcerer({
    authorityURI: naiveURI.createPartitionURI("valaa-test:"),
    authorityConfig: {
      eventVersion: EVENT_VERSION,
      isLocallyPersisted: true,
      isPrimaryAuthority: true,
      isRemoteAuthority: false,
      ...configOverrides,
    },
  });
}

export class MockFollower extends Follower {
  receiveTruths (truths: Object[]): Promise<(Promise<EventBase> | EventBase)[]> {
    return truths;
  }
  receiveCommands (commands: Object[]): Promise<(Promise<EventBase> | EventBase)[]> {
    return commands;
  }
}
