// @flow

import { OrderedMap } from "immutable";
import { created, EventBase } from "~/raem/events";

import { createTestPartitionURIFromRawId, createPartitionURI }
    from "~/raem/ValaaURI";

import { createCorpus } from "~/raem/test/RAEMTestHarness";

import ScriptTestHarness, { createScriptTestHarness } from "~/script/test/ScriptTestHarness";

import {
  AuthorityNexus, FalseProphet, FalseProphetDiscourse, Oracle, Prophet, Scribe, Follower,
} from "~/prophet";
import { obtainAspect } from "~/prophet/tools/EventAspects";

import ProphetTestAPI from "~/prophet/test/ProphetTestAPI";
import createValaaTestScheme, { MockProphet } from "~/prophet/test/scheme-valaa-test";
import createValaaLocalScheme from "~/prophet/schemeModules/valaa-local";
import createValaaMemoryScheme from "~/prophet/schemeModules/valaa-memory";
import createValaaTransientScheme from "~/prophet/schemeModules/valaa-transient";

import * as ValaaScriptDecoders from "~/script/mediaDecoders";
import * as ToolsDecoders from "~/tools/mediaDecoders";

import thenChainEagerly from "~/tools/thenChainEagerly";
import { getDatabaseAPI } from "~/tools/indexedDB/getInMemoryDatabaseAPI";
import { openDB } from "~/tools/html5/InMemoryIndexedDBUtils";
import { dumpObject, isPromise, wrapError } from "~/tools";

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
  const ret = createProphetTestHarness(
    { name: "Prophet Oracle Harness", oracleOptions: {}, scribeOptions: {}, ...options });
  try {
    ret.testPartitionConnection = await ret.testPartitionConnection;
    if (options.acquirePartitions) {
      const partitionURIs = options.acquirePartitions.map(
          partitionId => createPartitionURI("valaa-test:", partitionId));
      const connections = partitionURIs.map(uri =>
          ret.prophet.acquirePartitionConnection(uri).getSyncedConnection());
      (await Promise.all(connections)).forEach(connection => {
        if (ret.prophet.getVerbosity() >= 1) {
          console.log("PartitionConnection fully synced:", connection.debugId());
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
  id: "test_partition", typeName: "Entity",
  initialState: {
    name: "Automatic Test Partition Root",
    partitionAuthorityURI: "valaa-test:",
  },
});

export default class ProphetTestHarness extends ScriptTestHarness {
  constructor (options: Object) {
    super(options);
    if (options.oracleOptions) {
      this.upstream = this.oracle = createOracle(options.oracleOptions);
    } else {
      this.upstream = createTestMockProphet({ isLocallyPersisted: false });
    }
    if (options.scribeOptions) {
      this.upstream = this.scribe = createScribe(this.upstream, options.scribeOptions);
      this.cleanup = () => clearOracleScribeDatabases(this.scribe);
    } else {
      this.cleanup = () => undefined;
    }
    this.prophet.setUpstream(this.upstream);

    this.testPartitionURI = createTestPartitionURIFromRawId("test_partition");
    this.testPartitionConnection = thenChainEagerly(
        this.prophet.acquirePartitionConnection(this.testPartitionURI, { newPartition: true })
        .getSyncedConnection(), [
          (connection) => Promise.all([
            connection,
            this.chronicleEvent(createdTestPartitionEntity, { isTruth: true }).getPremiereStory(),
          ]),
          ([conn]) => (this.testPartitionConnection = conn),
        ]);

    this.nextCommandIdIndex = 1;
  }

  chronicleEvents (events: EventBase[], ...rest: any) {
    return this.prophet.chronicleEvents(events, ...rest);
  }

  createCorpus () { // Called by RAEMTestHarness.constructor (so before oracle/scribe are created)
    const corpus = super.createCorpus();
    this.prophet = createFalseProphet({ schema: this.schema, corpus, logger: this.getLogger(),
      assignCommandId: (command) => {
        obtainAspect(command, "command").id = `cid-${this.nextCommandIdIndex++}`;
      },
    });
    return corpus;
  }

  createValker () {
    return new FalseProphetDiscourse({
      prophet: this.prophet,
      follower: new Follower(),
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
    });
  }
}

export function createScribe (upstream: Prophet, options?: Object) {
  const ret = new Scribe({
    name: "Test Scribe",
    databaseAPI: getDatabaseAPI(),
    upstream,
    ...options,
  });
  ret.initiate();
  return ret;
}

export async function clearScribeDatabases (otherConnections: Object[] = []) {
  const partitionURIs = ["valaa-shared-content"];
  partitionURIs.push(...otherConnections);
  for (const uri of partitionURIs) {
    const database = await openDB(uri);
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

export function clearOracleScribeDatabases (prophet: Prophet) {
  return clearScribeDatabases(["valaa-test:?id=test_partition",
    ...Object.values(prophet.getSyncedConnections())
        .map(connection => connection.getPartitionURI().toString()),
  ]);
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
  return new MockProphet({
    authorityURI: createPartitionURI("valaa-test:"),
    authorityConfig: {
      isLocallyPersisted: true,
      isPrimaryAuthority: true,
      isRemoteAuthority: false,
      ...configOverrides,
    },
  });
}

export function createTestFollower () {
  return MockFollower();
}

class MockFollower extends Follower {}
