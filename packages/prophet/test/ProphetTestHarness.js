// @flow

import { OrderedMap } from "immutable";
import { created } from "~/raem/command";

import { createTestPartitionURIFromRawId, createPartitionURI }
    from "~/raem/ValaaURI";

import { Proclamation } from "~/prophet/FalseProphet/FalseProphet";

import ScriptTestHarness, { createScriptTestHarness } from "~/script/test/ScriptTestHarness";

import {
  AuthorityNexus, AuthorityProphet, AuthorityPartitionConnection,
  FalseProphet, FalseProphetDiscourse, Oracle, Prophecy,
  Prophet, Scribe,
} from "~/prophet";

import ProphetTestAPI from "~/prophet/test/ProphetTestAPI";
import createValaaTestScheme from "~/prophet/test/scheme-valaa-test";
import createValaaLocalScheme from "~/prophet/schemeModules/valaa-local";
import createValaaMemoryScheme from "~/prophet/schemeModules/valaa-memory";
import createValaaTransientScheme from "~/prophet/schemeModules/valaa-transient";

import * as ValaaScriptDecoders from "~/script/mediaDecoders";
import * as ToolsDecoders from "~/tools/mediaDecoders";

import { getDatabaseAPI } from "~/tools/indexedDB/getInMemoryDatabaseAPI";
import { openDB } from "~/tools/html5/InMemoryIndexedDBUtils";
import { dumpObject, wrapError } from "~/tools";

export function createProphetTestHarness (options: Object, ...proclamationBlocks: any) {
  const ret = createScriptTestHarness({
    name: "Prophet Test Harness", ContentAPI: ProphetTestAPI, TestHarness: ProphetTestHarness,
    ...options,
  });
  try {
    proclamationBlocks.forEach(proclamations => proclamations.forEach(
        proclamation => ret.proclaim(proclamation)));
    return ret;
  } catch (error) {
    throw wrapError(error, new Error("During createProphetTestHarness"),
        "\n\toptions:", ...dumpObject(options),
        "\n\tproclamationBlocks:", ...dumpObject(proclamationBlocks));
  }
}

export async function createProphetOracleHarness (options: Object, ...proclamationBlocks: any) {
  const ret = createProphetTestHarness(
    { name: "Prophet Oracle Harness", enableOracle: true, enableScribe: true, ...options });
  try {
    ret.testPartitionConnection = await ret.testPartitionConnection;
    if (options.acquirePartitions) {
      const partitionURIs = options.acquirePartitions.map(
          partitionId => createPartitionURI("valaa-test:?id=", partitionId));
      const connections = partitionURIs.map(uri =>
          ret.prophet.acquirePartitionConnection(uri).getSyncedConnection());
      await Promise.all(connections);
    }
    for (const proclamations of proclamationBlocks) {
      await Promise.all(proclamations.map(
          proclamation => ret.proclaim(proclamation).getStoryPremiere()));
    }
    return ret;
  } catch (error) {
    throw wrapError(error, new Error("During createProphetOracleHarness"),
        "\n\toptions:", ...dumpObject(options),
        "\n\tproclamationBlocks:", ...dumpObject(proclamationBlocks));
  }
}

export default class ProphetTestHarness extends ScriptTestHarness {
  constructor (options: Object) {
    super(options);
    if (options.enableOracle) {
      this.upstream = this.oracle = createOracle();
    } else {
      this.upstream = new MockProphet({
        authorityURI: createPartitionURI("valaa-test:"),
        authorityConfig: {
          isLocallyPersisted: false,
          isRemoteAuthority: false,
        },
      });
    }
    if (options.enableScribe) {
      this.upstream = this.scribe = createScribe(this.upstream);
      this.cleanup = () => clearOracleScribeDatabases(this.scribe);
    } else {
      this.cleanup = () => undefined;
    }
    this.prophet.setUpstream(this.upstream);

    this.testPartitionURI = createTestPartitionURIFromRawId("test_partition");
    this.testPartitionConnection = this.prophet
        .acquirePartitionConnection(this.testPartitionURI)
        .getSyncedConnection();
  }

  proclaim (...rest: any) {
    return this.prophet.proclaim(...rest);
  }

  createCorpus () { // Called by RAEMTestHarness.constructor (so before oracle/scribe are created)
    const corpus = super.createCorpus();
    this.prophet = new FalseProphet({
      name: "Test FalseProphet", schema: this.schema, corpus, logger: this.getLogger(),
    });
    return corpus;
  }

  createValker () {
    return new FalseProphetDiscourse({
      prophet: this.prophet,
      schema: this.schema,
      debugLevel: this.getDebugLevel(),
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

export function createScribe (oracle: Oracle) {
  const ret = new Scribe({
    name: "Test Scribe",
    databaseAPI: getDatabaseAPI(),
    upstream: oracle,
  });
  ret.initialize();
  return ret;
}

export async function clearScribeDatabases (otherConnections: Object[] = []) {
  const partitionURIs = ["test-partition:", "valaa-shared-content"];
  partitionURIs.push(...otherConnections);
  for (const uri of partitionURIs) {
    const database = await openDB(uri);
    for (const table of database.objectStoreNames) {
      const transaction = database.transaction([table], "readwrite");
      const objectStore = transaction.objectStore(table);
      objectStore.clear();
    }
  }
}

export function createOracle () {
  const authorityNexus = new AuthorityNexus();
  const ret = new Oracle({
    name: "Test Oracle",
    authorityNexus,
  });
  authorityNexus.addSchemeModule(createValaaLocalScheme({ logger: ret.getLogger() }));
  authorityNexus.addSchemeModule(createValaaTransientScheme({ logger: ret.getLogger() }));
  authorityNexus.addSchemeModule(createValaaMemoryScheme({ logger: ret.getLogger() }));
  authorityNexus.addSchemeModule(createValaaTestScheme({ logger: ret.getLogger() }));
  for (const Decoder: any of Object.values({ ...ToolsDecoders, ...ValaaScriptDecoders })) {
    if (Decoder.mediaTypes) {
      ret.getDecoderArray().addDecoder(new Decoder({ logger: ret.getLogger() }));
    }
  }
  return ret;
}

export function clearOracleScribeDatabases (prophet: Prophet) {
  return clearScribeDatabases(Object.values(prophet.getSyncedConnections())
      .map(connection => connection.getPartitionURI().toString()));
}

class MockPartitionConnection extends AuthorityPartitionConnection {}

class MockProphet extends AuthorityProphet {

  static PartitionConnectionType = MockPartitionConnection;

  addFollower (/* falseProphet */) {
    const connectors = {};
    return connectors;
  }

  proclaim (proclamation: Proclamation) {
    return {
      prophecy: new Prophecy(proclamation),
      getStoryPremiere: () => Promise.resolve(proclamation),
    };
  }
/*
  _createPartitionConnection (partition) {
    if
    return new MockPartitionConnection({
      prophet: this, partitionURI: new createPartitionURI("valaa-test:", "dummy"),
    });
  }
*/
}
