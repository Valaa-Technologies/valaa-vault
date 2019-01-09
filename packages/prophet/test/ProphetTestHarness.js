// @flow

import { OrderedMap } from "immutable";
import { created, EventBase } from "~/raem/events";

import { createPartitionURI } from "~/raem/ValaaURI";

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

import * as ValaaScriptDecoders from "~/script/mediaDecoders";
import * as ToolsDecoders from "~/tools/mediaDecoders";

import thenChainEagerly from "~/tools/thenChainEagerly";
import { getDatabaseAPI } from "~/tools/indexedDB/getInMemoryDatabaseAPI";
import { openDB } from "~/tools/html5/InMemoryIndexedDBUtils";
import { dumpify, dumpObject, isPromise, wrapError } from "~/tools";

export const testAuthorityURI = "valaa-test:";
export const testPartitionURI = createPartitionURI(testAuthorityURI, "test_partition");

export function createProphetTestHarness (options: Object, ...commandBlocks: any) {
  const ret = createScriptTestHarness({
    name: "Prophet Test Harness", ContentAPI: ProphetTestAPI, TestHarness: ProphetTestHarness,
    ...options,
  });
  try {
    commandBlocks.forEach(commands => {
      ret.chronicleEvents(commands).eventResults.forEach((result, index) => {
        if (isPromise((result.getTruthEvent || result.getTruthStory).call(result))) {
          throw new Error(`command #${index} getTruthEvent resolves into a Promise.${
              ""} Use the asynchronous createProphetOracleHarness instead.`);
        }
      });
    });
    return ret;
  } catch (error) {
    throw wrapError(error, new Error("During createProphetTestHarness"),
        "\n\toptions:", ...dumpObject(options),
        "\n\tcommandBlocks:", ...dumpObject(commandBlocks));
  }
}

export async function createProphetOracleHarness (options: Object, ...commandBlocks: any) {
  const isPaired = !!options.pairedHarness;
  const combinedOptions = {
    name: `${isPaired ? "Paired " : ""}Prophet Oracle Harness`,
    ...options,
    oracleOptions: {
      testAuthorityConfig: {
        ...(!isPaired ? {} : options.pairedHarness.testAuthorityConfig),
        ...((options.oracleOptions || {}).testAuthorityConfig || {}),
      },
      ...(options.oracleOptions || {}),
    },
    scribeOptions: {
      databasePrefix: isPaired ? "paired-" : "",
      ...(options.scribeOptions || {}),
    },
  };

  const ret = createProphetTestHarness(combinedOptions);

  ret.testAuthorityConfig = combinedOptions.oracleOptions.testAuthorityConfig;
  try {
    ret.testPartitionConnection = await ret.testPartitionConnection;
    if (options.acquirePartitions) {
      const partitionURIs = options.acquirePartitions.map(
          partitionId => createPartitionURI("valaa-test:", partitionId));
      const connections = partitionURIs.map(uri =>
          ret.prophet.acquirePartitionConnection(uri).getActiveConnection());
      (await Promise.all(connections)).forEach(connection => {
        if (ret.prophet.getVerbosity() >= 1) {
          console.log("PartitionConnection fully active:", connection.debugId());
        }
      });
    }
    for (const commands of commandBlocks) {
      await Promise.all(ret.chronicleEvents(commands).eventResults
          .map(result => result.getPremiereStory()));
    }
    return ret;
  } catch (error) {
    throw wrapError(error, new Error("During createProphetOracleHarness"),
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
    if (options.oracleOptions) {
      this.upstream = this.oracle = createOracle(options.oracleOptions);
    } else {
      this.upstream = createTestMockProphet({ isLocallyPersisted: false });
    }
    if (options.scribeOptions) {
      this.upstream = this.scribe = createScribe(this.upstream, options.scribeOptions);
      this.cleanup = () => clearScribeDatabases(this.scribe);
    } else {
      this.cleanup = () => undefined;
    }
    this.prophet.setUpstream(this.upstream);

    this.testAuthorityURI = options.testAuthorityURI || testAuthorityURI;
    this.testPartitionURI = options.testPartitionURI
        || (options.testAuthorityURI && createPartitionURI(this.testAuthorityURI, "test_partition"))
        || testPartitionURI;
    const activeTestPartitionConnection = this.prophet.acquirePartitionConnection(
        this.testPartitionURI, { newPartition: true }).getActiveConnection();

    this.testPartitionConnection = thenChainEagerly(activeTestPartitionConnection, [
      (connection) => {
        const testPartitionStory =
            this.chronicleEvent(createdTestPartitionEntity, { isTruth: true })
            .getPremiereStory();
        return Promise.all([connection, testPartitionStory]);
      },
      ([connection]) => (this.testPartitionConnection = connection),
    ]);
  }

  chronicleEvents (events: EventBase[], ...rest: any) {
    return this.chronicler.chronicleEvents(events, ...rest);
  }

  createCorpus (corpusOptions: Object = {}) {
    // Called by RAEMTestHarness.constructor (so before oracle/scribe are created)
    const corpus = super.createCorpus(corpusOptions);
    this.prophet = createFalseProphet({ schema: this.schema, corpus, logger: this.getLogger() });
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
      builtinSteppers: this.corpusOptions.builtinSteppers,
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
  } = {}) {
    for (const connection of ((source instanceof PartitionConnection)
        ? [source]
        : Object.values((source instanceof Prophet ? source : source.prophet)._connections))) {
      let testSourceBackend = connection;
      for (; testSourceBackend; testSourceBackend = testSourceBackend.getUpstreamConnection()) {
        if (testSourceBackend instanceof TestPartitionConnection) break;
      }
      if (!testSourceBackend) continue;
      const partitionURI = String(testSourceBackend.getPartitionURI());
      const receiver = this.oracle._connections[partitionURI];
      if (!receiver) {
        if (!requireReceivingConnection) continue;
        throw new Error(`Could not find a receiving connection for <${partitionURI}>`);
      }
      const receiverBackend = receiver.getUpstreamConnection();
      if (!receiverBackend || !(receiverBackend instanceof TestPartitionConnection)) {
        throw new Error(`Receving connection <${partitionURI
            }> has no TestPartitionConnection at the end of the chain`);
      }
      const truths = JSON.parse(JSON.stringify(
              (testSourceBackend._testUpstreamEntries || []).map(entry => entry.event)))
          .map(authorizeTruth);
      if (clearSourceUpstreamEntries) testSourceBackend._testUpstreamEntries = [];
      if (clearReceiverUpstreamEntries) receiverBackend._testUpstreamEntries = [];
      if (verbosity) {
        receiver.warnEvent("Receiving truths:", dumpify(truths, { indent: 2 }));
      }
      await receiverBackend.getReceiveTruths()(truths);
    }
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
  ret.initiate();
  return ret;
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
  for (const Decoder: any of Object.values({ ...ToolsDecoders, ...ValaaScriptDecoders })) {
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
    authorityURI: createPartitionURI("valaa-test:"),
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
