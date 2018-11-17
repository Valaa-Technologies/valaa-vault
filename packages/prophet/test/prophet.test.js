// @flow

import { created } from "~/raem/events";
import { getActionFromPassage } from "~/raem/redux/Bard";
import { vRef } from "~/raem/ValaaReference";
import { createPartitionURI } from "~/raem/ValaaURI";
import VALK from "~/raem/VALK";

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
    created({ id: "some_media", typeName: "Media", initialState: {
      name: "Simple Media", owner: "test_partition",
    } }),
    created({ id: "simple_relation", typeName: "Relation", initialState: {
      name: "Simple-other Relation", owner: vRef("simple_entity", "relations"),
      target: "some_media",
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
    expect(connection.getFirstCommandEventId()).toBeLessThanOrEqual(truthToCommandBorderEventId);
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
    await seconds[0].getPersistedEvent();
    await seconds[1].getPersistedEvent();
    expect(authorityConnection._upstreamEntries.length).toEqual(3);

    const twoEntries = authorityConnection._upstreamEntries.splice(0, 2);
    const twoTruthEvents = JSON.parse(JSON.stringify(twoEntries.map(entry => entry.event)));
    twoEntries[0].resolveTruthEvent(twoTruthEvents[0]);
    twoEntries[1].resolveTruthEvent(twoTruthEvents[1]);
    await authorityConnection.getReceiveTruths()(twoTruthEvents);
    expect(totalCommandCount).toEqual(1);
    expectConnectionEventIds(scribeConnection, 0, 3, 4);

    const lastEntry = authorityConnection._upstreamEntries.splice(0, 1);
    const lastTruthEvents = JSON.parse(JSON.stringify(lastEntry.map(entry => entry.event)));
    lastEntry[0].resolveTruthEvent(lastTruthEvents[0]);
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
    await first.getTruthEvent();
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

  it(`resolves getTruthEvent when command is reordered and others rejected,${
      ""} with a manual re-chronicle of the schismatic prophecies`, async () => {
    const { scribeConnection, authorityConnection } =
        await setUp({ isRemoteAuthority: true, isLocallyPersisted: true }, { verbosity: 0 });

    const rejectedSchisms = [];
    // Reject all schisms
    const reviseSchism = (schism) => { rejectedSchisms.push(schism); };

    expectConnectionEventIds(scribeConnection, 0, 1, 1);

    const first = harness.chronicleEvent(simpleCommand, { reviseSchism });
    expect(first.getCommandOf(testPartitionURI).eventId).toEqual(1);

    let firstTruth, firstFailure;
    const firstTruthProcess = first.getTruthEvent()
        .then(truthEvent_ => (firstTruth = truthEvent_), failure => (firstFailure = failure));

    await first.getPersistedEvent();

    expect(firstTruth).toEqual(undefined);

    const seconds = harness.chronicleEvents(coupleCommands, { reviseSchism }).eventResults;

    const secondsTruths = [], secondsFailures = [];
    const secondsTruthProcesses = seconds.map((result_, index) => result_.getTruthEvent().then(
            truthEvent_ => (secondsTruths[index] = truthEvent_),
            failure => (secondsFailures[index] = failure)));

    await seconds[1].getPersistedEvent();
    expectConnectionEventIds(scribeConnection, 0, 1, 4);

    expect(firstTruth).toEqual(undefined);
    expect(secondsTruths.length).toEqual(0);
    expect(secondsTruths[0]).toEqual(undefined);
    expect(secondsTruths[1]).toEqual(undefined);

    // Remove the first entry.
    authorityConnection._upstreamEntries.splice(0, 1);

    const oneEntries = authorityConnection._upstreamEntries.splice(0, 1);
    const oneTruthEvent = JSON.parse(JSON.stringify(oneEntries.map(entry => entry.event)));
    oneTruthEvent[0].eventId = 1;
    // The original third entry is now malformed, don't confirm it.
    authorityConnection._upstreamEntries.splice(0, 1);
    oneEntries[0].resolveTruthEvent(oneTruthEvent[0]);
    // Mismatching eventId's between sent commands and incoming truths
    // will inhibit prophecy partition command rechronicles and will
    // delay prophecy resolutions but otherwise has no other effect.
    expect(secondsTruths.length).toEqual(0);
    expectConnectionEventIds(scribeConnection, 0, 1, 4);
    await authorityConnection.getReceiveTruths()(oneTruthEvent);
    expectConnectionEventIds(scribeConnection, 0, 2, 2);

    expect(rejectedSchisms.length).toEqual(2);

    await firstTruthProcess;
    expect(firstFailure).not.toEqual(undefined);

    await secondsTruthProcesses[0];
    await secondsTruthProcesses[1];

    expect(seconds[0].getCommandOf(testPartitionURI).eventId).toEqual(1);
    expect(seconds[1].getCommandOf(testPartitionURI)).toEqual(null);
    expect(secondsTruths.length).toEqual(1);
    expect(secondsFailures.length).toEqual(2);
    expect(secondsFailures[0]).toEqual(undefined);

    // Re-chronicle manually

    const rechronicleResults = harness.chronicleEvents(
        [...rejectedSchisms].map(getActionFromPassage)).eventResults;
    expect(await rechronicleResults[0].getPersistedEvent()).toMatchObject(simpleCommand);
    expect(await rechronicleResults[1].getPersistedEvent()).toMatchObject(coupleCommands[1]);

    expectConnectionEventIds(scribeConnection, 0, 2, 4);

    // Check that first command has been properly revised and resent
    expect(rechronicleResults[0].getCommandOf(testPartitionURI).eventId).toEqual(2);
    expect(authorityConnection._upstreamEntries.length).toEqual(2);

    const lastEntry = authorityConnection._upstreamEntries.splice(0, 2);
    const lastTruthEvents = JSON.parse(JSON.stringify(lastEntry.map(entry => entry.event)));
    // skip resolveTruthEvent - rely on downstream push only via getReceiveTruths
    // lastEntry[0].resolveTruthEvent(coupleCommands[1]);
    await authorityConnection.getReceiveTruths()(lastTruthEvents);
    expectConnectionEventIds(scribeConnection, 0, 4, 4);

    expect(await rechronicleResults[0].getTruthEvent()).toMatchObject(simpleCommand);
    expect(await rechronicleResults[1].getTruthEvent()).toMatchObject(coupleCommands[1]);

    expect(harness.run(vRef("simple_entity"),
            VALK.toField("relations").toIndex(0).toField("target").toField("name")))
        .toEqual("Simple Media");
  });

  it("resolves getTruthEvent when a command is reordered and others revised", async () => {
    const { scribeConnection, authorityConnection } =
        await setUp({ isRemoteAuthority: true, isLocallyPersisted: true }, { verbosity: 0 });

    // Repeat the steps of the previous test case...
    const first = harness.chronicleEvent(simpleCommand);
    let firstTruth, firstFailure;
    const firstTruthProcess = first.getTruthEvent()
        .then(truthEvent_ => (firstTruth = truthEvent_), failure => (firstFailure = failure));
    await first.getPersistedEvent();
    const seconds = harness.chronicleEvents(coupleCommands).eventResults;
    const secondsTruths = [], secondsFailures = [];
    const secondsTruthProcesses = seconds.map((result_, index) => result_.getTruthEvent().then(
        truthEvent_ => (secondsTruths[index] = truthEvent_),
        failure => (secondsFailures[index] = failure)));
    await seconds[1].getPersistedEvent();
    const secondsFirstEntries = authorityConnection._upstreamEntries.splice(1, 1);
    authorityConnection._upstreamEntries = [];
    const secondsFirstTruth = JSON.parse(JSON.stringify(
        secondsFirstEntries.map(entry => entry.event)));
    secondsFirstTruth[0].eventId = 1; // reordering...
    secondsFirstEntries[0].resolveTruthEvent(secondsFirstTruth[0]);
    await authorityConnection.getReceiveTruths()(secondsFirstTruth);
    // ...until a divergence due to revise-instead-of-reject happens here.
    await seconds[0].getTruthEvent();
    expect(seconds[0].getCommandOf(testPartitionURI).eventId).toEqual(1);
    expectConnectionEventIds(scribeConnection, 0, 2, 4);
    expect(first.getCommandOf(testPartitionURI).eventId).toEqual(2);
    expect(seconds[1].getCommandOf(testPartitionURI).eventId).toEqual(3);
    await seconds[1].getPersistedEvent();

    expect(authorityConnection._upstreamEntries.length).toEqual(2);
    const stageTwoEntries = JSON.parse(JSON.stringify(
        authorityConnection._upstreamEntries.splice(0, 2).map(entry => entry.event)));
    expect(stageTwoEntries[0].eventId).toEqual(2);
    expect(stageTwoEntries[1].eventId).toEqual(3);
    await authorityConnection.getReceiveTruths()(stageTwoEntries);
    expectConnectionEventIds(scribeConnection, 0, 4, 4);

    await firstTruthProcess;
    expect(firstTruth).toMatchObject(simpleCommand);
    expect(firstFailure).toEqual(undefined);
    expect(first.getCommandOf(testPartitionURI)).toMatchObject(stageTwoEntries[0]);

    await secondsTruthProcesses[0];
    await secondsTruthProcesses[1];
    expect(seconds[0].getCommandOf(testPartitionURI).eventId).toEqual(1);
    expect(JSON.parse(JSON.stringify(seconds[1].getCommandOf(testPartitionURI))))
        .toMatchObject(stageTwoEntries[1]);

    expect(secondsTruths.length).toEqual(2);
    expect(secondsFailures.length).toEqual(0);
  });

  it("reviews prophecies and resolves getTruthEvent with incoming foreign truths", async () => {
    const { scribeConnection, authorityConnection } =
        await setUp({ isRemoteAuthority: true, isLocallyPersisted: true }, { verbosity: 0 });

    // Repeat the steps of the previous test case...
    const first = harness.chronicleEvent(simpleCommand);
    let firstTruth, firstFailure;
    const firstTruthProcess = first.getTruthEvent()
        .then(truthEvent_ => (firstTruth = truthEvent_), failure => (firstFailure = failure));
    await first.getPersistedEvent();
    const seconds = harness.chronicleEvents(coupleCommands).eventResults;
    const secondsTruths = [], secondsFailures = [];
    const secondsTruthProcesses = seconds.map((result_, index) => result_.getTruthEvent().then(
            truthEvent_ => (secondsTruths[index] = truthEvent_),
            failure => (secondsFailures[index] = failure)));
    await seconds[1].getPersistedEvent();
    expectConnectionEventIds(scribeConnection, 0, 1, 4);
    expect(authorityConnection._upstreamEntries.length).toEqual(3);
    authorityConnection._upstreamEntries = [];
    const foreignTruth = created({
      id: "foreign_entity", typeName: "Entity", initialState: {
        name: "Simple Entity", owner: "test_partition",
      },
      version: "0.2", commandId: "foreign_entity", eventId: 1,
    });
    await authorityConnection.getReceiveTruths()([foreignTruth]);
    await seconds[1].getPersistedEvent();
    expectConnectionEventIds(scribeConnection, 0, 2, 5);

    expect(authorityConnection._upstreamEntries.length).toEqual(3);
    const stageTwoEntries = JSON.parse(JSON.stringify(
        authorityConnection._upstreamEntries.splice(0, 3).map(entry => entry.event)));
    expect(stageTwoEntries[0].eventId).toEqual(2);
    expect(stageTwoEntries[1].eventId).toEqual(3);
    expect(stageTwoEntries[2].eventId).toEqual(4);
    await authorityConnection.getReceiveTruths()(stageTwoEntries);
    expectConnectionEventIds(scribeConnection, 0, 5, 5);

    await firstTruthProcess;
    expect(firstTruth).toMatchObject(simpleCommand);
    expect(firstFailure).toEqual(undefined);
    expect(first.getCommandOf(testPartitionURI)).toMatchObject(stageTwoEntries[0]);

    await secondsTruthProcesses[0];
    await secondsTruthProcesses[1];
    expect(JSON.parse(JSON.stringify(seconds[0].getCommandOf(testPartitionURI))))
        .toMatchObject(stageTwoEntries[1]);
    expect(JSON.parse(JSON.stringify(seconds[1].getCommandOf(testPartitionURI))))
        .toMatchObject(stageTwoEntries[2]);

    expect(secondsTruths.length).toEqual(2);
    expect(secondsFailures.length).toEqual(0);
  });
});
