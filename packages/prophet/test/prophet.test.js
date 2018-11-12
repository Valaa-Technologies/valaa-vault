// @flow

import { created } from "~/raem/command/index";
import { vRef } from "~/raem/ValaaReference";
import { createPartitionURI } from "~/raem/ValaaURI";

import {
  createScribe, clearScribeDatabases, createTestMockProphet, createOracle,
  createProphetOracleHarness,
} from "~/prophet/test/ProphetTestHarness";

import { openDB, expectStoredInDB } from "~/tools/html5/InMemoryIndexedDBUtils";

const testAuthorityURI = "valaa-test:";
const testPartitionURI = createPartitionURI(testAuthorityURI, "test_partition");

let harness = null;

afterEach(async () => {
  if (harness) {
    await harness.cleanup();
    harness = null;
  } else await clearScribeDatabases(/* [testPartitionURI] */);
});

describe("Prophet", () => {
  const structuredMediaContents = [
    [`"Hello world"`, { name: "hello.txt", type: "text", subtype: "plain" }, `"Hello world"`],
    [`"Hello world"`, { name: "hello.txt", type: "text", subtype: "whatevs" }, `"Hello world"`],
    [`"Hello world"`, { name: "hello.json", type: "application", subtype: "json" }, "Hello world"],
    [`{ "a": 10 }`, { name: "a10.json", type: "application", subtype: "json" }, { a: 10 }],
  ];

  it("decodes cached bvob buffers based on media type", async () => {
    const scribe = createScribe(createOracle(createTestMockProphet()));
    await scribe.initiate();

    const connection = await scribe.acquirePartitionConnection(testPartitionURI)
        .getSyncedConnection();

    const mediaId = vRef("abcd-0123");
    for (const [bufferContent, mediaInfo, expectedContent] of structuredMediaContents) {
      const preparedBvob = connection.prepareBvob(bufferContent);
      const bvobId = await preparedBvob.persistProcess;
      const decodedContent =
          await connection.decodeMediaContent({ mediaId, bvobId, ...mediaInfo });
      expect(decodedContent).toEqual(expectedContent);
    }
  });

  const commands = [
    created({ id: "Entity A", typeName: "Entity", initialState: { owner: "test_partition" } }),
    created({ id: "Entity B", typeName: "Entity", initialState: { owner: "test_partition" } }),
    created({ id: "Entity C", typeName: "Entity", initialState: { owner: "test_partition" } }),
    created({ id: "Entity D", typeName: "Entity", initialState: { owner: "test_partition" } }),
    created({ id: "Entity E", typeName: "Entity", initialState: { owner: "test_partition" } }),
    created({ id: "Entity F", typeName: "Entity", initialState: { owner: "test_partition" } }),
  ];

  it("stores the contents of the actions on the scribe correctly", async () => {
    harness = await createProphetOracleHarness({ verbosity: 0,
      oracleOptions: { testAuthorityConfig: { isLocallyPersisted: true, isRemoteAuthority: true } },
    });
    const prophetConnection = await harness.prophet
        .acquirePartitionConnection(testPartitionURI).getSyncedConnection();
    const scribeConnection = prophetConnection.getUpstreamConnection();
    const database = await openDB(testPartitionURI.toString());

    for (const command of commands) {
      const claimResult = await harness.chronicleEvent(command);
      await claimResult.getPremiereStory();
      const partitionCommand = await claimResult.getCommandOf(testPartitionURI);
      const eventId = scribeConnection.getFirstUnusedCommandEventId() - 1;
      await expectStoredInDB(partitionCommand, database, "commands", eventId);
    }
  });

  it("assigns proper eventIds for commands", async () => {
    harness = await createProphetOracleHarness({ verbosity: 0,
      oracleOptions: { testAuthorityConfig: { isLocallyPersisted: true } },
    });
    const prophetConnection = await harness.prophet
        .acquirePartitionConnection(testPartitionURI).getSyncedConnection();
    const scribeConnection = prophetConnection.getUpstreamConnection();

    let oldCommandId;
    let newCommandId = scribeConnection.getFirstUnusedCommandEventId() - 1;

    for (const command of commands) {
      oldCommandId = newCommandId;

      await harness.chronicleEvent(command).getPremiereStory();

      newCommandId = scribeConnection.getFirstUnusedCommandEventId() - 1;
      expect(oldCommandId).toBeLessThan(newCommandId);
    }
  });
});

describe("Prophet", () => {
  const simpleCommand = created({
    id: "simple_entity", typeName: "Entity", initialState: {
      name: "Simple Entity", owner: "test_partition",
    }
  });

  const coupleCommands = [
    created({ id: "other_entity", typeName: "Entity", initialState: {
      name: "Some other entity", owner: "test_partition",
    } }),
    created({ id: "simple_relation", typeName: "Relation", initialState: {
      name: "Simple-other Relation", owner: vRef("simple_entity", "relations"),
      target: "other_entity",
    } }),
  ];

  async function setUp (testAuthorityConfig: Object = {}, options: {}) {
    harness = await createProphetOracleHarness({ verbosity: 0,
      oracleOptions: { testAuthorityConfig },
      ...options,
    });
    const ret = {
      connection: await harness.prophet.acquirePartitionConnection(
          testPartitionURI).getSyncedConnection(),
      scribeConnection: await harness.scribe.acquirePartitionConnection(
          testPartitionURI, { newConnection: false }).getSyncedConnection(),
      oracleConnection: await harness.oracle.acquirePartitionConnection(
          testPartitionURI, { newConnection: false }).getSyncedConnection(),
    };
    ret.authorityConnection = ret.oracleConnection.getUpstreamConnection();
    return ret;
  }

  function expectConnectionEventIds (connection,
      truthEventIdBegin, truthToCommandBorderEventId, commandEventIdEnd) {
    expect(connection.getFirstTruthEventId()).toEqual(truthEventIdBegin);
    expect(connection.getFirstUnusedTruthEventId()).toEqual(truthToCommandBorderEventId);
    expect(connection.getFirstCommandEventId()).toEqual(truthToCommandBorderEventId);
    expect(connection.getFirstUnusedCommandEventId()).toEqual(commandEventIdEnd);
  }

  it("confirms remote partition commands as truths", async () => {
    const { scribeConnection, authorityConnection } =
        await setUp({ isRemoteAuthority: true, isLocallyPersisted: true }, { verbosity: 0 });
    let totalCommandCount;
    harness.prophet.setCommandCountCallback((total) => { totalCommandCount = total; });
    expect(totalCommandCount).toEqual(0);
    expectConnectionEventIds(scribeConnection, 0, 1, 1);

    const first = harness.chronicleEvent(simpleCommand);

    expect(first.getCommandOf(testPartitionURI).eventId).toEqual(1);
    expect(totalCommandCount).toEqual(1);
    expectConnectionEventIds(scribeConnection, 0, 1, 2);
    expect(authorityConnection._upstreamEntries.length).toEqual(0);
    await first.getPersistedEvent();
    expect(authorityConnection._upstreamEntries.length).toEqual(1);
    expectConnectionEventIds(scribeConnection, 0, 1, 2);

    const seconds = harness.chronicleEvents(coupleCommands).eventResults;

    expect(seconds[0].getCommandOf(testPartitionURI).eventId).toEqual(2);
    expect(seconds[1].getCommandOf(testPartitionURI).eventId).toEqual(3);
    expectConnectionEventIds(scribeConnection, 0, 1, 4);
    expect(totalCommandCount).toEqual(3);
    expect(authorityConnection._upstreamEntries.length).toEqual(1);
    await seconds[1].getPersistedEvent();
    expect(authorityConnection._upstreamEntries.length).toEqual(3);

    const twoEntries = authorityConnection._upstreamEntries.splice(0, 2);
    const twoTruthEvents = JSON.parse(JSON.stringify(twoEntries.map(entry => entry.event)));
    twoEntries[0].resolveTruthEvent();
    twoEntries[1].resolveTruthEvent();
    await authorityConnection.getReceiveTruths()(twoTruthEvents);
    expect(totalCommandCount).toEqual(1);
    expectConnectionEventIds(scribeConnection, 0, 3, 4);

    const lastEntry = authorityConnection._upstreamEntries.splice(0, 1);
    const lastTruthEvents = JSON.parse(JSON.stringify(lastEntry.map(entry => entry.event)));
    lastEntry[0].resolveTruthEvent();
    await authorityConnection.getReceiveTruths()(lastTruthEvents);
    expect(totalCommandCount).toEqual(0);
    expectConnectionEventIds(scribeConnection, 0, 4, 4);
  });

  it("automatically confirms local partition commands as truths", async () => {
    const { scribeConnection } = await setUp({ isLocallyPersisted: true }, { verbosity: 0 });
    let totalCommandCount;
    harness.prophet.setCommandCountCallback((total) => { totalCommandCount = total; });
    expect(totalCommandCount).toEqual(0);
    expectConnectionEventIds(scribeConnection, 0, 1, 1);
    const first = harness.chronicleEvent(simpleCommand);
    expect(first.getCommandOf(testPartitionURI).eventId).toEqual(1);
    expect(totalCommandCount).toEqual(1);
    expectConnectionEventIds(scribeConnection, 0, 1, 2);
    const persisted = first.getPersistedEvent();
    expectConnectionEventIds(scribeConnection, 0, 1, 2);
    await persisted;
    expect(totalCommandCount).toEqual(0);
    expectConnectionEventIds(scribeConnection, 0, 2, 2);

    const seconds = harness.chronicleEvents(coupleCommands).eventResults;
    expect(seconds[0].getCommandOf(testPartitionURI).eventId).toEqual(2);
    expect(seconds[1].getCommandOf(testPartitionURI).eventId).toEqual(3);
    expect(totalCommandCount).toEqual(2);
    expectConnectionEventIds(scribeConnection, 0, 2, 4);
    await seconds[1].getPersistedEvent();
    expect(totalCommandCount).toEqual(0);
    expectConnectionEventIds(scribeConnection, 0, 4, 4);
  });


  it("resolves getTruthEvent when its commands are confirmed by either pull or push", async () => {
    const { scribeConnection, authorityConnection } =
        await setUp({ isRemoteAuthority: true, isLocallyPersisted: true }, { verbosity: 0 });
    expectConnectionEventIds(scribeConnection, 0, 1, 1);

    const first = harness.chronicleEvent(simpleCommand);

    let firstTruth;
    const firstTruthProcess = first.getTruthEvent().then(truthEvent_ => (firstTruth = truthEvent_));

    await first.getPersistedEvent();

    expect(firstTruth).toEqual(undefined);

    const seconds = harness.chronicleEvents(coupleCommands).eventResults;

    const secondsTruths = [];
    const secondsTruthProcesses = seconds.map((result_, index) => result_.getTruthEvent()
        .then(truthEvent_ => (secondsTruths[index] = truthEvent_)));

    await seconds[1].getPersistedEvent();

    expect(firstTruth).toEqual(undefined);
    expect(secondsTruths.length).toEqual(0);
    expect(secondsTruths[0]).toEqual(undefined);
    expect(secondsTruths[1]).toEqual(undefined);


    const twoEntries = authorityConnection._upstreamEntries.splice(0, 2);
    const twoTruthEvents = JSON.parse(JSON.stringify(twoEntries.map(entry => entry.event)));
    // resolve prophecy getTruthEvent via pull
    twoEntries[0].resolveTruthEvent(twoTruthEvents[0]);
    twoEntries[1].resolveTruthEvent(twoTruthEvents[1]);
    expect(await firstTruthProcess).toMatchObject(simpleCommand);
    expect(await secondsTruthProcesses[0]).toMatchObject(coupleCommands[0]);
    expect(secondsTruths.length).toEqual(1);
    // pull doesn't store anything to scribe, let push take care of that (really??)
    expectConnectionEventIds(scribeConnection, 0, 1, 4);
    await authorityConnection.getReceiveTruths()(twoTruthEvents);
    expectConnectionEventIds(scribeConnection, 0, 3, 4);

    const lastEntry = authorityConnection._upstreamEntries.splice(0, 1);
    const lastTruthEvents = JSON.parse(JSON.stringify(lastEntry.map(entry => entry.event)));
    // skip resolveTruthEvent - rely on downstream push via getReceiveTruths
    // lastEntry[0].resolveTruthEvent(coupleCommands[1]);
    await authorityConnection.getReceiveTruths()(lastTruthEvents);
    expectConnectionEventIds(scribeConnection, 0, 4, 4);

    expect(await secondsTruthProcesses[1]).toMatchObject(coupleCommands[1]);
    expect(secondsTruths.length).toEqual(2);
  });
});
