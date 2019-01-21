// @flow

import { is as immutableIs } from "immutable";

import { created } from "~/raem/events";
import { getActionFromPassage } from "~/raem/redux/Bard";
import { vRef } from "~/raem/ValaaReference";
import { createPartitionURI } from "~/raem/ValaaURI";
import VALK from "~/raem/VALK";

import {
  createScribe, clearAllScribeDatabases, createTestMockProphet, createOracle,
  createProphetOracleHarness, testPartitionURI,
} from "~/prophet/test/ProphetTestHarness";
import { initializeAspects, obtainAspect } from "~/prophet/tools/EventAspects";

import { openDB, expectStoredInDB } from "~/tools/html5/InMemoryIndexedDBUtils";

let harness = null;

async function setUp (testAuthorityConfig: Object = {}, options: {}) {
  harness = await createProphetOracleHarness({ verbosity: 0,
    oracleOptions: { testAuthorityConfig },
    ...options,
  });
  const ret = {
    connection: await harness.prophet.acquirePartitionConnection(
        harness.testPartitionURI).getActiveConnection(),
    scribeConnection: await harness.scribe.acquirePartitionConnection(
        harness.testPartitionURI, { newConnection: false }).getActiveConnection(),
    oracleConnection: await harness.oracle.acquirePartitionConnection(
        harness.testPartitionURI, { newConnection: false }).getActiveConnection(),
  };
  ret.authorityConnection = ret.oracleConnection.getUpstreamConnection();
  return ret;
}

afterEach(async () => {
  if (harness) {
    await harness.cleanup();
    harness = null;
  }
  await clearAllScribeDatabases(/* [testPartitionURI] */);
});

describe("Prophet", () => {
  const structuredMediaContents = [
    [`"Hello world"`, { name: "hello.txt", type: "text", subtype: "plain" }, `"Hello world"`],
    [`"Hello world"`, { name: "hello.txt", type: "text", subtype: "whatevs" }, `"Hello world"`],
    [`"Hello world"`, { name: "hello.json", type: "application", subtype: "json" }, "Hello world"],
    [`{ "a": 10 }`, { name: "a10.json", type: "application", subtype: "json" }, { a: 10 }],
  ];

  it("decodes cached bvob buffers based on media type", async () => {
    const scribe = createScribe(createOracle());
    await scribe.initiate();

    const connection = await scribe.acquirePartitionConnection(createPartitionURI("valaa-test:"))
        .getActiveConnection();

    const mediaRef = vRef("abcd-0123");
    for (const [bufferContent, mediaInfo, expectedContent] of structuredMediaContents) {
      const preparedBvob = connection.prepareBvob(bufferContent);
      const bvobId = await preparedBvob.persistProcess;
      const decodedContent =
          await connection.decodeMediaContent({ mediaRef, bvobId, ...mediaInfo });
      expect(decodedContent).toEqual(expectedContent);
    }
  });

  const commands = [
    created({ id: ["Entity-A"], typeName: "Entity", initialState: { owner: ["test_partition"] } }),
    created({ id: ["Entity-B"], typeName: "Entity", initialState: { owner: ["test_partition"] } }),
    created({ id: ["Entity-C"], typeName: "Entity", initialState: { owner: ["test_partition"] } }),
    created({ id: ["Entity-D"], typeName: "Entity", initialState: { owner: ["test_partition"] } }),
    created({ id: ["Entity-E"], typeName: "Entity", initialState: { owner: ["test_partition"] } }),
    created({ id: ["Entity-F"], typeName: "Entity", initialState: { owner: ["test_partition"] } }),
  ];

  it("stores the contents of the actions on the scribe correctly", async () => {
    harness = await createProphetOracleHarness({ verbosity: 0,
      oracleOptions: { testAuthorityConfig: { isLocallyPersisted: true, isRemoteAuthority: true } },
    });
    const prophetConnection = await harness.prophet
        .acquirePartitionConnection(harness.testPartitionURI).getActiveConnection();
    const scribeConnection = prophetConnection.getUpstreamConnection();
    const database = await openDB(scribeConnection._db.databaseId);

    for (const command of commands) {
      const claimResult = await harness.chronicleEvent(command);
      await claimResult.getPremiereStory();
      const partitionCommand = await claimResult.getCommandOf(harness.testPartitionURI);
      const logIndex = scribeConnection.getFirstUnusedCommandEventId() - 1;
      await expectStoredInDB(partitionCommand, database, "commands", logIndex);
    }
  });

  it("assigns proper eventIds for commands", async () => {
    harness = await createProphetOracleHarness({ verbosity: 0,
      oracleOptions: { testAuthorityConfig: { isLocallyPersisted: true } },
    });
    const prophetConnection = await harness.prophet
        .acquirePartitionConnection(harness.testPartitionURI).getActiveConnection();
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
    id: ["simple_entity"], typeName: "Entity", initialState: {
      name: "Simple Entity", owner: ["test_partition", {}, {}],
    }
  });

  const coupleCommands = [
    created({ id: ["some_media"], typeName: "Media", initialState: {
      name: "Simple Media",
      owner: ["test_partition", { partition: String(testPartitionURI) }, {}],
    } }),
    created({ id: ["simple_relation"], typeName: "Relation", initialState: {
      name: "Simple-other Relation",
      owner: vRef("simple_entity", "relations", undefined, testPartitionURI).toJSON(),
      target: ["some_media", { partition: String(testPartitionURI) }],
    } }),
  ];

  function expectConnectionEventIds (connection,
      truthEventIdBegin, truthToCommandBorderEventId, commandEventIdEnd) {
    expect(connection.getFirstTruthEventId()).toEqual(truthEventIdBegin);
    expect(connection.getFirstUnusedTruthEventId()).toEqual(truthToCommandBorderEventId);
    expect(connection.getFirstCommandEventId()).toBeLessThanOrEqual(truthToCommandBorderEventId);
    expect(connection.getFirstUnusedCommandEventId()).toEqual(commandEventIdEnd);
  }

  function roundtripEvent (event) {
    return JSON.parse(JSON.stringify(event));
  }

  it("confirms remote partition commands as truths", async () => {
    const { scribeConnection, authorityConnection } =
        await setUp({ isRemoteAuthority: true, isLocallyPersisted: true }, { verbosity: 0 });
    let totalCommandCount;
    harness.prophet.setCommandCountCallback((total) => { totalCommandCount = total; });
    expect(totalCommandCount).toEqual(0);
    expectConnectionEventIds(scribeConnection, 0, 1, 1);

    const first = harness.chronicleEvent(simpleCommand);

    expect(first.getLogAspectFor(harness.testPartitionURI).index).toEqual(1);
    await harness.prophet._mostRecentNotification;
    expect(totalCommandCount).toEqual(1);
    expectConnectionEventIds(scribeConnection, 0, 1, 2);
    expect(authorityConnection._chroniclings.length).toEqual(0);
    await first.getPersistedEvent();
    expect(authorityConnection._chroniclings.length).toEqual(1);
    expectConnectionEventIds(scribeConnection, 0, 1, 2);

    const seconds = harness.chronicleEvents(coupleCommands).eventResults;

    expect(seconds[0].getLogAspectFor(harness.testPartitionURI).index).toEqual(2);
    expect(seconds[1].getLogAspectFor(harness.testPartitionURI).index).toEqual(3);
    expectConnectionEventIds(scribeConnection, 0, 1, 4);
    await harness.prophet._mostRecentNotification;
    expect(totalCommandCount).toEqual(3);
    expect(authorityConnection._chroniclings.length).toEqual(1);
    await seconds[0].getPersistedEvent();
    await seconds[1].getPersistedEvent();
    expect(authorityConnection._chroniclings.length).toEqual(3);

    const twoEntries = authorityConnection._chroniclings.splice(0, 2);
    const twoTruthEvents = twoEntries.map(entry => roundtripEvent(entry.event));

    twoEntries[0].resolveTruthEvent(twoTruthEvents[0]);
    twoEntries[1].resolveTruthEvent(twoTruthEvents[1]);
    await authorityConnection.getReceiveTruths()(twoTruthEvents);
    await harness.prophet._mostRecentNotification;
    expect(totalCommandCount).toEqual(1);
    expectConnectionEventIds(scribeConnection, 0, 3, 4);

    const lastEntry = authorityConnection._chroniclings.splice(0, 1);
    const lastTruthEvents = lastEntry.map(entry => roundtripEvent(entry.event));
    lastEntry[0].resolveTruthEvent(lastTruthEvents[0]);
    await authorityConnection.getReceiveTruths()(lastTruthEvents);
    await harness.prophet._mostRecentNotification;
    expect(totalCommandCount).toEqual(0);
    expectConnectionEventIds(scribeConnection, 0, 4, 4);
  });

  it("automatically confirms local partition commands as truths", async () => {
    const { scribeConnection } = await setUp({ isLocallyPersisted: true }, { verbosity: 0 });
    let totalCommandCount;
    harness.prophet.setCommandCountCallback((total) => { totalCommandCount = total; });
    await harness.prophet._mostRecentNotification;
    expect(totalCommandCount).toEqual(0);
    expectConnectionEventIds(scribeConnection, 0, 1, 1);
    const first = harness.chronicleEvent(simpleCommand);
    expect(first.getLogAspectFor(harness.testPartitionURI).index).toEqual(1);
    await harness.prophet._mostRecentNotification;
    expect(totalCommandCount).toEqual(1);
    expectConnectionEventIds(scribeConnection, 0, 1, 2);
    const persisted = first.getPersistedEvent();
    expectConnectionEventIds(scribeConnection, 0, 1, 2);
    await persisted;
    await harness.prophet._mostRecentNotification;
    expect(totalCommandCount).toEqual(0);
    await first.getTruthEvent();
    expectConnectionEventIds(scribeConnection, 0, 2, 2);

    const seconds = harness.chronicleEvents(coupleCommands).eventResults;
    expect(seconds[0].getLogAspectFor(harness.testPartitionURI).index).toEqual(2);
    expect(seconds[1].getLogAspectFor(harness.testPartitionURI).index).toEqual(3);
    await harness.prophet._mostRecentNotification;
    expect(totalCommandCount).toEqual(2);
    expectConnectionEventIds(scribeConnection, 0, 2, 4);
    await seconds[1].getPersistedEvent();
    await harness.prophet._mostRecentNotification;
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


    const twoEntries = authorityConnection._chroniclings.splice(0, 2);
    const twoTruthEvents = twoEntries.map(entry => roundtripEvent(entry.event));
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

    const lastEntry = authorityConnection._chroniclings.splice(0, 1);
    const lastTruthEvents = lastEntry.map(entry => roundtripEvent(entry.event));
    // skip resolveTruthEvent - rely on downstream push via getReceiveTruths
    // lastEntry[0].resolveTruthEvent(coupleCommands[1]);
    await authorityConnection.getReceiveTruths()(lastTruthEvents);
    expectConnectionEventIds(scribeConnection, 0, 4, 4);

    expect(await secondsTruthProcesses[1]).toMatchObject(coupleCommands[1]);
    expect(secondsTruths.length).toEqual(2);
  });

  it("resolves getTruthEvent when command is reordered and others rejected", async () => {
    const { scribeConnection, authorityConnection } =
        await setUp({ isRemoteAuthority: true, isLocallyPersisted: true }, { verbosity: 0 });

    const rejectedSchisms = [];
    // Reject all schisms
    const reviseSchism = (schism) => { rejectedSchisms.push(schism); };

    expectConnectionEventIds(scribeConnection, 0, 1, 1);

    const first = harness.chronicleEvent(simpleCommand, { reviseSchism });
    expect(first.getLogAspectFor(harness.testPartitionURI).index).toEqual(1);

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
    authorityConnection._chroniclings.splice(0, 1);

    const oneEntries = authorityConnection._chroniclings.splice(0, 1);
    const oneTruthEvent = oneEntries.map(entry => roundtripEvent(entry.event));
    obtainAspect(oneTruthEvent[0], "log").index = 1;
    // The original third entry is now malformed, don't confirm it.
    authorityConnection._chroniclings.splice(0, 1);
    oneEntries[0].resolveTruthEvent(oneTruthEvent[0]);
    // Mismatching log.index's between sent commands and incoming truths
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

    expect(seconds[0].getLogAspectFor(harness.testPartitionURI).index).toEqual(1);
    expect(seconds[1].getCommandOf(harness.testPartitionURI)).toEqual(null);
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
    expect(rechronicleResults[0].getLogAspectFor(harness.testPartitionURI).index).toEqual(2);
    expect(authorityConnection._chroniclings.length).toEqual(2);

    const lastEntry = authorityConnection._chroniclings.splice(0, 2);
    const lastTruthEvents = lastEntry.map(entry => roundtripEvent(entry.event));
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
    const secondsFirstEntries = authorityConnection._chroniclings.splice(1, 1);
    authorityConnection._chroniclings = [];
    const secondsFirstTruth = secondsFirstEntries.map(entry => roundtripEvent(entry.event));
    obtainAspect(secondsFirstTruth[0], "log").index = 1; // reordering...
    secondsFirstEntries[0].resolveTruthEvent(secondsFirstTruth[0]);
    await authorityConnection.getReceiveTruths()(secondsFirstTruth);
    // ...until a divergence due to revise-instead-of-reject happens here.
    await seconds[0].getTruthEvent();
    expect(seconds[0].getLogAspectFor(harness.testPartitionURI).index).toEqual(1);
    expectConnectionEventIds(scribeConnection, 0, 2, 4);
    expect(first.getLogAspectFor(harness.testPartitionURI).index).toEqual(2);
    expect(seconds[1].getLogAspectFor(harness.testPartitionURI).index).toEqual(3);
    await seconds[1].getPersistedEvent();

    expect(authorityConnection._chroniclings.length).toEqual(2);
    const stageTwoEntries = authorityConnection._chroniclings.splice(0, 2)
        .map(entry => roundtripEvent(entry.event));
    expect(stageTwoEntries[0].aspects.log.index).toEqual(2);
    expect(stageTwoEntries[1].aspects.log.index).toEqual(3);
    await authorityConnection.getReceiveTruths()(stageTwoEntries);
    expectConnectionEventIds(scribeConnection, 0, 4, 4);

    await firstTruthProcess;
    expect(firstTruth).toMatchObject(simpleCommand);
    expect(firstFailure).toEqual(undefined);
    expect(first.getCommandOf(harness.testPartitionURI)).toMatchObject(stageTwoEntries[0]);

    await secondsTruthProcesses[0];
    await secondsTruthProcesses[1];
    expect(seconds[0].getLogAspectFor(harness.testPartitionURI).index).toEqual(1);
    expect(roundtripEvent(seconds[1].getCommandOf(harness.testPartitionURI)))
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
    expect(authorityConnection._chroniclings.length).toEqual(3);
    authorityConnection._chroniclings = [];
    const foreignTruth = initializeAspects(created({
      id: ["foreign_entity"], typeName: "Entity", initialState: {
        name: "Simple Entity", owner: ["test_partition"],
      },
    }), { version: "0.2", command: { id: "foreign_entity" }, log: { index: 1 } });
    await authorityConnection.getReceiveTruths()([foreignTruth]);
    await seconds[1].getPersistedEvent();
    expectConnectionEventIds(scribeConnection, 0, 2, 5);

    expect(authorityConnection._chroniclings.length).toEqual(3);
    const stageTwoEntries = authorityConnection._chroniclings.splice(0, 3)
        .map(entry => roundtripEvent(entry.event));
    expect(stageTwoEntries[0].aspects.log.index).toEqual(2);
    expect(stageTwoEntries[1].aspects.log.index).toEqual(3);
    expect(stageTwoEntries[2].aspects.log.index).toEqual(4);
    await authorityConnection.getReceiveTruths()(stageTwoEntries);
    expectConnectionEventIds(scribeConnection, 0, 5, 5);

    await firstTruthProcess;
    expect(firstTruth).toMatchObject(simpleCommand);
    expect(firstFailure).toEqual(undefined);
    expect(first.getCommandOf(harness.testPartitionURI)).toMatchObject(stageTwoEntries[0]);

    await secondsTruthProcesses[0];
    await secondsTruthProcesses[1];
    expect(JSON.parse(JSON.stringify(seconds[0].getCommandOf(harness.testPartitionURI))))
        .toMatchObject(stageTwoEntries[1]);
    expect(JSON.parse(JSON.stringify(seconds[1].getCommandOf(harness.testPartitionURI))))
        .toMatchObject(stageTwoEntries[2]);

    expect(secondsTruths.length).toEqual(2);
    expect(secondsFailures.length).toEqual(0);
  });
});

describe("Cross-partition", () => {
  it("handles out-of-order cross-partition incomingRelations", async () => {
    const { scribeConnection } =
        await setUp({ isRemoteAuthority: true, isLocallyPersisted: true }, { verbosity: 0 });
    const latePartitionURI = createPartitionURI(harness.testAuthorityURI, "test_late");

    const lateTargetId = vRef("late_target", undefined, undefined, latePartitionURI);

    await scribeConnection.chronicleEvent(created({
      id: ["CrossRelation_A"], typeName: "Relation",
      initialState: {
        source: ["test_partition"], name: "CrossRelation", target: lateTargetId.toJSON(),
      },
      aspects: {
        version: "0.2",
        log: { index: scribeConnection.getFirstUnusedCommandEventId() },
        command: { id: "cid-1" },
      },
    }), { isTruth: true }).getPersistedEvent();

    const lateConnection = harness.prophet.acquirePartitionConnection(latePartitionURI);
    harness.tryGetTestAuthorityConnection(lateConnection).addNarrateResults({ eventIdBegin: 0 }, [
      created({
        id: ["test_late"], typeName: "Entity",
        initialState: { name: "Test Late" },
        aspects: { version: "0.2", log: { index: 0 }, command: { id: "lid-0" } },
      }),
      created({
        id: ["late_target"], typeName: "Entity",
        initialState: { name: "Late Target" },
        aspects: { version: "0.2", log: { index: 1 }, command: { id: "lid-1" } },
      }),
    ]);
    await lateConnection.getActiveConnection();
    const incomingRelations = harness.run(lateTargetId, "incomingRelations");
    expect(incomingRelations.length)
        .toEqual(1);
  });

  it("handles out-of-order instantiation with properties in both partitions", async () => {
    const { scribeConnection } =
        await setUp({ isRemoteAuthority: true, isLocallyPersisted: true }, { verbosity: 0 });
    const latePartitionURI = createPartitionURI(harness.testAuthorityURI, "test_late");

    const latePrototypeId = vRef("late_prototype", undefined, undefined, latePartitionURI);

    const index = scribeConnection.getFirstUnusedCommandEventId();
    await Promise.all(scribeConnection.chronicleEvents([
      created({
        id: ["CrossEntryInstance_A"], typeName: "Entity",
        initialState: { owner: ["test_partition"], instancePrototype: latePrototypeId.toJSON(),
          name: "Cross-partition instance",
        },
        aspects: { version: "0.2", log: { index: index + 0 }, command: { id: "cid-1" } },
      }),
      created({
        id: ["CrossEntryInstance_A-foo"], typeName: "Property",
        initialState: { owner: ["CrossEntryInstance_A", {}, { coupling: "properties" }],
          name: "bar",
        },
        aspects: { version: "0.2", log: { index: index + 1 }, command: { id: "cid-2" } },
      })], { isTruth: true }).eventResults.map(result => result.getPersistedEvent()));

    const lateConnection = harness.prophet.acquirePartitionConnection(latePartitionURI);
    harness.tryGetTestAuthorityConnection(lateConnection).addNarrateResults({ eventIdBegin: 0 }, [
      created({
        id: ["test_late"], typeName: "Entity",
        initialState: { name: "Test Late" },
        aspects: { version: "0.2", log: { index: 0 }, command: { id: "lid-0" } },
      }),
      created({
        id: ["late_prototype"], typeName: "Entity",
        initialState: { name: "Late Prototype" },
        aspects: { version: "0.2", log: { index: 1 }, command: { id: "lid-1" } },
      }),
      created({
        id: ["late_prototype-bar"], typeName: "Property",
        initialState: { owner: ["late_prototype", {}, { coupling: "properties" }],
          name: "foo",
        },
        aspects: { version: "0.2", log: { index: 2 }, command: { id: "lid-3" } },
      }),
    ]);
    await lateConnection.getActiveConnection();

    const properties = harness.run(vRef("CrossEntryInstance_A"),
        ["§->", "properties", ["§map", "name"]]);
    expect(properties)
        .toEqual(["foo", "bar"]);
  });
});

describe("Disjoint clients using paired harnesses", () => {
  it("delivers commands from one harness as events to another harness", async () => {
    const { scribeConnection } = await setUp({ isRemoteAuthority: true, isLocallyPersisted: true },
        { verbosity: 0 });
    const pairness = await createProphetOracleHarness({ verbosity: 0, pairedHarness: harness });
    const pairedConnection = pairness.prophet.acquirePartitionConnection(harness.testPartitionURI);

    const result = harness.chronicleEvent(created({
      id: ["multiharness-entity"], typeName: "Entity",
      initialState: { owner: ["test_partition"], name: "Multi-harness test entity" },
      aspects: { version: "0.2", log: {}, command: { id: "cid-1" } },
    }));
    await result.getPersistedEvent();
    await pairness.receiveTruthsFrom(harness);
    expect(scribeConnection.getFirstCommandEventId())
        .toEqual(1);
    expect(pairedConnection.getUpstreamConnection().getFirstCommandEventId())
        .toEqual(2);
    await harness.receiveTruthsFrom(harness, { clearUpstreamEntries: true });
    expect(scribeConnection.getFirstCommandEventId())
        .toEqual(2);
  });

  it("reorders conflicting commands between harnesses", async () => {
    await setUp({ isRemoteAuthority: true, isLocallyPersisted: true }, { verbosity: 0 });
    const pairness = await createProphetOracleHarness({ verbosity: 0, pairedHarness: harness });
    await pairness.prophet.acquirePartitionConnection(harness.testPartitionURI);

    const result = harness.chronicleEvent(created({
      id: ["multiharness-entity"], typeName: "Entity",
      initialState: { owner: ["test_partition"], name: "Multi-harness test entity" },
      aspects: { version: "0.2", log: {}, command: { id: "cid-1" } },
    }));
    await result.getLocalEvent();
    expect(result.getCommandOf(harness.testPartitionURI).aspects.log.index)
        .toEqual(1);

    const pairedResult = pairness.chronicleEvent(created({
      id: ["pairedharness-entity"], typeName: "Entity",
      initialState: { owner: ["test_partition"], name: "Multi-harness distinct entity" },
      aspects: { version: "0.2", log: {}, command: { id: "cid-p-1" } },
    }));
    await pairedResult.getPersistedEvent();
    expect(pairedResult.getCommandOf(harness.testPartitionURI).aspects.log.index)
        .toEqual(1);
    // Make paired harness commands into truths first.
    await harness.receiveTruthsFrom(pairness, { clearReceiverUpstreamEntries: true });
    await pairness.receiveTruthsFrom(pairness, { clearReceiverUpstreamEntries: true });
    // Re-send reordered commands by harness.
    await pairness.receiveTruthsFrom(harness);
    await harness.receiveTruthsFrom(harness, { clearReceiverUpstreamEntries: true });
    expect(immutableIs(harness.corpus.getState(), pairness.corpus.getState()))
        .toEqual(true);
    expect(harness.run(vRef("test_partition"), ["§->", "unnamedOwnlings", ["§map", "name"]]))
        .toEqual(["Multi-harness distinct entity", "Multi-harness test entity"]);
    expect(pairness.run(vRef("test_partition"), ["§->", "unnamedOwnlings", ["§map", "name"]]))
        .toEqual(["Multi-harness distinct entity", "Multi-harness test entity"]);
  });
});
