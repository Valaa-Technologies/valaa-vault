// @flow

import { OrderedMap } from "immutable";
import { created, EventBase } from "~/raem/events";

import { naiveURI } from "~/raem/ValaaURI";

import { createCorpus } from "~/raem/test/RAEMTestHarness";

import ScriptTestHarness, { createScriptTestHarness } from "~/script/test/ScriptTestHarness";

import {
  AuthorityNexus, FalseProphet, FalseProphetDiscourse, Oracle, PartitionConnection, Prophet,
  Scribe, Follower,
} from "~/prophet";
import { obtainAspect } from "~/prophet/tools/EventAspects";
import EVENT_VERSION from "~/prophet/tools/EVENT_VERSION";

import ProphetTestAPI from "~/prophet/test/ProphetTestAPI";
import createValaaTestScheme, { TestProphet, TestPartitionConnection }
    from "~/prophet/test/scheme-valaa-test";
import createValaaLocalScheme from "~/prophet/schemeModules/valaa-local";
import createValaaMemoryScheme from "~/prophet/schemeModules/valaa-memory";
import createValaaTransientScheme from "~/prophet/schemeModules/valaa-transient";

import * as ValoscriptDecoders from "~/script/mediaDecoders";
import * as ToolsDecoders from "~/tools/mediaDecoders";

import thenChainEagerly from "~/tools/thenChainEagerly";
import { getDatabaseAPI } from "~/tools/indexedDB/getInMemoryDatabaseAPI";
import { openDB } from "~/tools/html5/InMemoryIndexedDBUtils";
import { dumpify, dumpObject, isPromise, wrapError } from "~/tools";

export const testAuthorityURI = "valaa-test:";
export const testPartitionURI = naiveURI.createPartitionURI(testAuthorityURI, "test_partition");

export function createProphetTestHarness (options: Object, ...commandBlocks: any) {
  const wrap = new Error("During createProphetHarness");
  return thenChainEagerly({
    name: "Prophet Test Harness", ContentAPI: ProphetTestAPI, TestHarness: ProphetTestHarness,
    ...options,
  }, [
    prophetOptions => createScriptTestHarness(prophetOptions),
    harness => {
      commandBlocks.forEach(commands => {
        harness.chronicleEvents(commands).eventResults.forEach((result, index) => {
          if (isPromise((result.getTruthEvent || result.getTruthStory).call(result))) {
            throw new Error(`command #${index} getTruthEvent resolves into a Promise.${
                ""} Use the asynchronous createProphetOracleHarness instead.`);
          }
        });
      });
      return harness;
    }
  ], function errorOnCreateProphetHarness (error) {
    throw wrapError(error, wrap,
        "\n\toptions:", ...dumpObject(options),
        "\n\tcommandBlocks:", ...dumpObject(commandBlocks));
  });
}

let dbIsolationAutoPrefix = 0;

export async function createProphetOracleHarness (options: Object, ...commandBlocks: any) {
  const isPaired = !!options.pairedHarness;
  const combinedOptions = {
    name: `${isPaired ? "Paired " : ""}Prophet Oracle Harness`,
    ...options,
    oracleOptions: {
      verbosity: options.verbosity || 0,
      testAuthorityConfig: {
        ...(!isPaired ? {} : options.pairedHarness.testAuthorityConfig),
        ...((options.oracleOptions || {}).testAuthorityConfig || {}),
      },
      ...(options.oracleOptions || {}),
    },
    scribeOptions: {
      verbosity: options.verbosity || 0,
      databasePrefix: `${isPaired ? "paired" : "test"}-isolated-${++dbIsolationAutoPrefix}-`,
      ...(options.scribeOptions || {}),
    },
  };

  const ret = await createProphetTestHarness(combinedOptions);
  try {
    if (options.acquirePartitions) {
      const partitionURIs = options.acquirePartitions.map(
          partitionId => naiveURI.createPartitionURI("valaa-test:", partitionId));
      const connections = partitionURIs.map(uri =>
          ret.prophet.acquirePartitionConnection(uri).getActiveConnection());
      (await Promise.all(connections)).forEach(connection => {
        if (ret.prophet.getVerbosity() >= 1) {
          console.log("PartitionConnection fully active:", connection.debugId());
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
    throw ret.wrapErrorEvent(error, new Error("During createProphetOracleHarness"),
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

export default class ProphetTestHarness extends ScriptTestHarness {
  constructor (options: Object) {
    super(options);
    this.nextCommandIdIndex = 1;
    this.oracleOptions = options.oracleOptions;
    if (this.oracleOptions) this.testAuthorityConfig = this.oracleOptions.testAuthorityConfig;
    this.scribeOptions = options.scribeOptions;
    this.cleanupScribe = () => (this.scribeOptions && clearAllScribeDatabases(this.scribe));
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
          () => createTestMockProphet({ isLocallyPersisted: false }),
        ] : [
          () => createOracle(this.oracleOptions),
          oracle => (this.oracle = oracle),
        ]),
        ...(!this.scribeOptions ? [] : [
          upstream => createScribe(upstream, this.scribeOptions),
          scribe => (this.scribe = scribe),
        ]),
        upstream => this.prophet.setUpstream(upstream),
        () => {
          hasRemoteTestBackend = (this.testAuthorityConfig || {}).isRemoteAuthority;
          const testConnection = this.prophet.acquirePartitionConnection(
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
          return testConnection.getActiveConnection();
        },
        (testConnection) => (this.testConnection = testConnection),
          // For non-remotes we chronicle the root entity explicitly.
        () => {
          if (hasRemoteTestBackend) return undefined;
          const result = this.chronicleEvent(createdTestPartitionEntity, { isTruth: true });
          return result.getPremiereStory();
        },
      ],
      ProphetTestHarness.errorOn(new Error("ProphetTestHarness.initialize")),
    );
  }

  chronicleEvents (events: EventBase[], ...rest: any) {
    return this.chronicler.chronicleEvents(events, ...rest);
  }

  createCorpus (corpusOptions: Object = {}) {
    // Called by RAEMTestHarness.constructor (so before oracle/scribe are created)
    const corpus = super.createCorpus(corpusOptions);
    this.prophet = this.falseProphet = createFalseProphet({
      schema: this.schema, corpus, logger: this.getLogger(), ...this.falseProphetOptions,
    });
    this.chronicler = this.prophet;
    return corpus;
  }

  createValker () {
    return (this.discourse = this.chronicler = new FalseProphetDiscourse({
      prophet: this.prophet,
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
   * @param {(Prophet | PartitionConnection)} source
   * @param {*} [{
   *     requireReceivingConnection = true,
   *     clearSourceUpstreamEntries = false,
   *     clearReceiverUpstreamEntries = false,
   *     authorizeTruth = (i => i),
   *   }={}]
   * @memberof ProphetTestHarness
   */
  async receiveTruthsFrom (source: Prophet | PartitionConnection, {
    verbosity = 0,
    requireReceivingConnection = true,
    clearSourceUpstreamEntries = false,
    clearReceiverUpstreamEntries = false,
    authorizeTruth = (i => i),
    asNarrateResults = false,
  } = {}) {
    for (const connection of ((source instanceof PartitionConnection)
        ? [source]
        : Object.values((source instanceof Prophet ? source : source.prophet)._connections))) {
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
            }> has no TestPartitionConnection at the end of the chain`);
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

  tryGetTestAuthorityConnection (connection): PartitionConnection {
    let ret = connection;
    for (; ret; ret = ret.getUpstreamConnection()) {
      if (ret instanceof TestPartitionConnection) break;
    }
    return ret;
  }

  createMockFollower () {
    const ret = MockFollower();
    ret.discourse = ret.prophet.addFollower(ret);
    return ret;
  }
}

const activeScribes = [];

export function createScribe (upstream: Prophet, options?: Object) {
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

export function createOracle (options?: Object) {
  const authorityNexus = new AuthorityNexus();
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
  const corpus = (options && options.corpus) || createCorpus(ProphetTestAPI, {}, {});
  return new FalseProphet({
    name: "Test FalseProphet",
    corpus,
    ...options,
  });
}

export function createTestMockProphet (configOverrides: Object = {}) {
  return new TestProphet({
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
