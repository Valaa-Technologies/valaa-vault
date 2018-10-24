// @flow

import { OrderedMap } from "immutable";
import { created } from "~/raem/command";

import { createTestPartitionURIFromRawId, createPartitionURI }
    from "~/raem/ValaaURI";

import ScriptTestHarness, { createScriptTestHarness } from "~/script/test/ScriptTestHarness";
import { createCorpus } from "~/raem/test/RAEMTestHarness";

import {
  AuthorityNexus, AuthorityProphet, AuthorityPartitionConnection,
  FalseProphet, FalseProphetDiscourse, Oracle, Prophet, Scribe,
} from "~/prophet";

import ProphetTestAPI from "~/prophet/test/ProphetTestAPI";
import createValaaTestScheme from "~/prophet/test/scheme-valaa-test";
import createValaaLocalScheme from "~/prophet/schemeModules/valaa-local";
import createValaaMemoryScheme from "~/prophet/schemeModules/valaa-memory";
import createValaaTransientScheme from "~/prophet/schemeModules/valaa-transient";

import * as ValaaScriptDecoders from "~/script/mediaDecoders";
import * as ToolsDecoders from "~/tools/mediaDecoders";

import thenChainEagerly from "~/tools/thenChainEagerly";
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
    { name: "Prophet Oracle Harness", oracleOptions: {}, scribeOptions: {}, ...options });
  try {
    ret.testPartitionConnection = await ret.testPartitionConnection;
    if (options.acquirePartitions) {
      const partitionURIs = options.acquirePartitions.map(
          partitionId => createPartitionURI("valaa-test:", partitionId));
      const connections = partitionURIs.map(uri =>
          ret.prophet.acquirePartitionConnection(uri).getSyncedConnection());
      (await Promise.all(connections)).forEach(connection => {
        if (ret.prophet.getDebugLevel() >= 1) {
          console.log("PartitionConnection fully synced:", connection.debugId());
        }
      });
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

export const proclamationCREATEDTestPartitionEntity = created({
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
      this.upstream = createTestMockProphet();
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
          (conn) => Promise.all([
            conn, this.proclaim(proclamationCREATEDTestPartitionEntity).getStoryPremiere(),
          ]),
          ([conn]) => (this.testPartitionConnection = conn),
        ]);
  }

  proclaim (...rest: any) {
    return this.prophet.proclaim(...rest);
  }

  createCorpus () { // Called by RAEMTestHarness.constructor (so before oracle/scribe are created)
    const corpus = super.createCorpus();
    this.prophet = createFalseProphet({ schema: this.schema, corpus, logger: this.getLogger() });
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
  const partitionURIs = ["valaa-shared-content", "valaa-test:?id=test_partition"];
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
  return clearScribeDatabases(Object.values(prophet.getSyncedConnections())
      .map(connection => connection.getPartitionURI().toString()));
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
      isLocallyPersisted: false,
      isPrimaryAuthority: true,
      isRemoteAuthority: false,
      ...configOverrides,
    },
  });
}

class MockPartitionConnection extends AuthorityPartitionConnection {}

export class MockProphet extends AuthorityProphet {

  static PartitionConnectionType = MockPartitionConnection;

  addFollower (/* falseProphet */) {
    const connectors = {};
    return connectors;
  }

/*
  proclaim (proclamation: Proclamation) {
    return {
      prophecy: new Prophecy(proclamation),
      getStoryPremiere: () => Promise.resolve(proclamation),
    };
  }

  _createPartitionConnection (partition) {
    if
    return new MockPartitionConnection({
      prophet: this, partitionURI: new createPartitionURI("valaa-test:", "dummy"),
    });
  }
*/
}
