// @flow

import { is as immutableIs } from "immutable";

import { created } from "~/raem/events";
import { getActionFromPassage } from "~/raem/redux/Bard";
import { vRef } from "~/raem/VRL";
import { naiveURI } from "~/raem/ValaaURI";
import VALK from "~/raem/VALK";

import {
  testRootId,
  createScribe, clearAllScribeDatabases, createOracle, createSourcererOracleHarness,
  testChronicleURI,
} from "~/sourcerer/test/SourcererTestHarness";
import { initializeAspects, obtainAspect } from "~/sourcerer/tools/EventAspects";
import { CHRONICLE_DB_VERSION } from "~/sourcerer/Scribe";

import { openDB, closeDB, expectStoredInDB } from "~/tools/html5/InMemoryIndexedDBUtils";

let harness = null;

async function setUp (testAuthorityConfig: Object = {}, options: {}) {
  harness = await createSourcererOracleHarness({ verbosity: 0,
    ...options,
    oracle: { ...(options.oracle || {}), testAuthorityConfig },
  });
  const ret = {
    connection: await harness.sourcerer.sourcerChronicle(
        harness.testChronicleURI).asSourceredConnection(),
    scribeConnection: await harness.scribe.sourcerChronicle(
        harness.testChronicleURI, { newConnection: false }).asSourceredConnection(),
    oracleConnection: await harness.oracle.sourcerChronicle(
        harness.testChronicleURI, { newConnection: false }).asSourceredConnection(),
  };
  ret.authorityConnection = ret.oracleConnection.getUpstreamConnection();
  return ret;
}

afterEach(async () => {
  if (harness) {
    await harness.cleanupScribe();
    harness = null;
  }
  await clearAllScribeDatabases(/* [testChronicleURI] */);
});

const simpleEntityId = "@$~raw.simple_entity@@";

describe("Sourcerer", () => {
  const structuredMediaContents = [
    [`"Hello world"`, { name: "hello.txt", contentType: "text/plain" }, `"Hello world"`],
    [`"Hello world"`, { name: "hello.txt", contentType: "text/whatevs" }, `"Hello world"`],
    [`"Hello world"`, { name: "hello.json", contentType: "application/json" }, "Hello world"],
    [`{ "a": 10 }`, { name: "a10.json", contentType: "application/json" }, { a: 10 }],
  ];

  it("decodes cached bvob buffers based on media type", async () => {
    const scribe = await createScribe(createOracle());

    const connection = await scribe
        .sourcerChronicle(naiveURI.createChronicleURI("valaa-test:", testRootId))
        .asSourceredConnection();

    const mediaVRL = vRef("abcd-0123");
    for (const [bufferContent, mediaInfo, expectedContent] of structuredMediaContents) {
      const preparation = await connection.prepareBvob(bufferContent);
      const contentHash = await preparation.persistProcess;
      const decodedContent = await connection.decodeMediaContent({
        mediaVRL, contentHash, /* bvobId: contentHash, */ ...mediaInfo,
      });
      expect(decodedContent).toEqual(expectedContent);
    }
  });

  const commands = [
    created({ id: ["Entity-A"], typeName: "Entity", initialState: { owner: [testRootId] } }),
    created({ id: ["Entity-B"], typeName: "Entity", initialState: { owner: [testRootId] } }),
    created({ id: ["Entity-C"], typeName: "Entity", initialState: { owner: [testRootId] } }),
    created({ id: ["Entity-D"], typeName: "Entity", initialState: { owner: [testRootId] } }),
    created({ id: ["Entity-E"], typeName: "Entity", initialState: { owner: [testRootId] } }),
    created({ id: ["Entity-F"], typeName: "Entity", initialState: { owner: [testRootId] } }),
  ];

  it("stores the contents of the actions on the scribe correctly", async () => {
    harness = await createSourcererOracleHarness({ verbosity: 0,
      oracle: { testAuthorityConfig: { isLocallyRecorded: true, isRemoteAuthority: true } },
    });
    const connection = await harness.sourcerer
        .sourcerChronicle(harness.testChronicleURI).asSourceredConnection();
    const scribeConnection = connection.getUpstreamConnection();
    const database = await openDB(scribeConnection._db.databaseId, CHRONICLE_DB_VERSION);

    for (const command of commands) {
      const claimResult = await harness.proclaimTestEvent(command);
      await claimResult.getRecordedStory();
      const venueCommand = await claimResult.getCommandOf(harness.testChronicleURI);
      const logIndex = scribeConnection.getFirstUnusedCommandEventId() - 1;
      await expectStoredInDB(venueCommand, database, "commands", logIndex);
    }

    closeDB(database);
  });

  it("assigns proper eventIds for commands", async () => {
    harness = await createSourcererOracleHarness({ verbosity: 0,
      oracle: { testAuthorityConfig: { isLocallyRecorded: true } },
    });
    const connection = await harness.sourcerer
        .sourcerChronicle(harness.testChronicleURI).asSourceredConnection();
    const scribeConnection = connection.getUpstreamConnection();

    let oldCommandId;
    let newCommandId = scribeConnection.getFirstUnusedCommandEventId() - 1;

    for (const command of commands) {
      oldCommandId = newCommandId;

      await harness.proclaimTestEvent(command).getPremiereStory();

      newCommandId = scribeConnection.getFirstUnusedCommandEventId() - 1;
      expect(oldCommandId).toBeLessThan(newCommandId);
    }
  });
});

describe("Sourcerer", () => {
  const simpleCommand = created({
    id: [simpleEntityId], typeName: "Entity", initialState: {
      name: "Simple Entity", owner: [testRootId, {}, {}],
    }
  });

  const coupleCommands = [
    created({ id: ["@$~raw.some_media@@"], typeName: "Media", initialState: {
      name: "Simple Media",
      owner: [testRootId, { partition: String(testChronicleURI) }, {}],
    } }),
    created({ id: ["@$~raw.simple_relation@@"], typeName: "Relation", initialState: {
      name: "Simple-other Relation",
      owner: vRef("simple_entity", "relations", undefined, testChronicleURI).toJSON(),
      target: ["@$~raw.some_media@@", { partition: String(testChronicleURI) }],
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

  it("confirms remote chronicle commands as truths", async () => {
    const { scribeConnection, authorityConnection } =
        await setUp({ isRemoteAuthority: true, isLocallyRecorded: true }, { verbosity: 0 });
    let totalCommandCount;
    harness.sourcerer.setCommandCountCallback((total) => { totalCommandCount = total; });
    expect(totalCommandCount).toEqual(0);
    expectConnectionEventIds(scribeConnection, 0, 1, 1);

    const first = harness.proclaimTestEvent(simpleCommand);

    expect(first.getLogAspectOf(harness.testChronicleURI).index).toEqual(1);
    await harness.sourcerer._pendingCommandNotification;
    expect(totalCommandCount).toEqual(1);
    expectConnectionEventIds(scribeConnection, 0, 1, 2);
    expect(authorityConnection._proclamations.length).toEqual(0);
    await first.getRecordedEvent();
    expect(authorityConnection._proclamations.length).toEqual(1);
    expectConnectionEventIds(scribeConnection, 0, 1, 2);

    const seconds = harness.proclaimTestEvents(coupleCommands).eventResults;

    expect(seconds[0].getLogAspectOf(harness.testChronicleURI).index).toEqual(2);
    expect(seconds[1].getLogAspectOf(harness.testChronicleURI).index).toEqual(3);
    expectConnectionEventIds(scribeConnection, 0, 1, 4);
    await harness.sourcerer._pendingCommandNotification;
    expect(totalCommandCount).toEqual(3);
    expect(authorityConnection._proclamations.length).toEqual(1);
    await seconds[0].getRecordedEvent();
    await seconds[1].getRecordedEvent();
    expect(authorityConnection._proclamations.length).toEqual(3);

    const twoEntries = authorityConnection._proclamations.splice(0, 2);
    const twoTruthEvents = twoEntries.map(entry => roundtripEvent(entry.event));

    twoEntries[0].resolveTruthEvent(twoTruthEvents[0]);
    twoEntries[1].resolveTruthEvent(twoTruthEvents[1]);
    await authorityConnection.getReceiveTruths()(twoTruthEvents);
    await harness.sourcerer._pendingCommandNotification;
    expect(totalCommandCount).toEqual(1);
    expectConnectionEventIds(scribeConnection, 0, 3, 4);

    const lastEntry = authorityConnection._proclamations.splice(0, 1);
    const lastTruthEvents = lastEntry.map(entry => roundtripEvent(entry.event));
    lastEntry[0].resolveTruthEvent(lastTruthEvents[0]);
    await authorityConnection.getReceiveTruths()(lastTruthEvents);
    await harness.sourcerer._pendingCommandNotification;
    expect(totalCommandCount).toEqual(0);
    expectConnectionEventIds(scribeConnection, 0, 4, 4);
  });

  it("automatically confirms local chronicle commands as truths", async () => {
    const { scribeConnection } = await setUp({ isLocallyRecorded: true }, { verbosity: 0 });
    let totalCommandCount;
    harness.sourcerer.setCommandCountCallback((total) => { totalCommandCount = total; });
    await harness.sourcerer._pendingCommandNotification;
    expect(totalCommandCount).toEqual(0);
    expectConnectionEventIds(scribeConnection, 0, 1, 1);
    const first = harness.proclaimTestEvent(simpleCommand);
    expect(first.getLogAspectOf(harness.testChronicleURI).index).toEqual(1);
    await harness.sourcerer._pendingCommandNotification;
    expect(totalCommandCount).toEqual(1);
    expectConnectionEventIds(scribeConnection, 0, 1, 2);
    const recorded = first.getRecordedEvent();
    expectConnectionEventIds(scribeConnection, 0, 1, 2);
    await recorded;
    await harness.sourcerer._pendingCommandNotification;
    expect(totalCommandCount).toEqual(0);
    await first.getTruthEvent();
    expectConnectionEventIds(scribeConnection, 0, 2, 2);

    const seconds = harness.proclaimTestEvents(coupleCommands).eventResults;
    expect(seconds[0].getLogAspectOf(harness.testChronicleURI).index).toEqual(2);
    expect(seconds[1].getLogAspectOf(harness.testChronicleURI).index).toEqual(3);
    await harness.sourcerer._pendingCommandNotification;
    expect(totalCommandCount).toEqual(2);
    expectConnectionEventIds(scribeConnection, 0, 2, 4);
    await seconds[1].getRecordedEvent();
    await harness.sourcerer._pendingCommandNotification;
    expect(totalCommandCount).toEqual(0);
    expectConnectionEventIds(scribeConnection, 0, 4, 4);
  });

  it("resolves getTruthEvent when its commands are confirmed by either pull or push", async () => {
    const { scribeConnection, authorityConnection } =
        await setUp({ isRemoteAuthority: true, isLocallyRecorded: true }, { verbosity: 0 });
    expectConnectionEventIds(scribeConnection, 0, 1, 1);

    const first = harness.proclaimTestEvent(simpleCommand);

    let firstTruth;
    const firstTruthProcess = first.getTruthEvent().then(truthEvent_ => (firstTruth = truthEvent_));

    await first.getRecordedEvent();

    expect(firstTruth).toEqual(undefined);

    const seconds = harness.proclaimTestEvents(coupleCommands).eventResults;

    const secondsTruths = [];
    const secondsTruthProcesses = seconds.map((result_, index) => result_.getTruthEvent()
        .then(truthEvent_ => (secondsTruths[index] = truthEvent_)));

    await seconds[1].getRecordedEvent();

    expect(firstTruth).toEqual(undefined);
    expect(secondsTruths.length).toEqual(0);
    expect(secondsTruths[0]).toEqual(undefined);
    expect(secondsTruths[1]).toEqual(undefined);


    const twoEntries = authorityConnection._proclamations.splice(0, 2);
    const twoTruthEvents = twoEntries.map(entry => roundtripEvent(entry.event));
    // resolve prophecy getTruthEvent via pull
    twoEntries[0].resolveTruthEvent(twoTruthEvents[0]);
    twoEntries[1].resolveTruthEvent(twoTruthEvents[1]);
    expectConnectionEventIds(scribeConnection, 0, 1, 4);
    expect(await firstTruthProcess).toMatchObject(simpleCommand);
    expectConnectionEventIds(scribeConnection, 0, 3, 4);
    expect(await secondsTruthProcesses[0]).toMatchObject(coupleCommands[0]);
    expect(secondsTruths.length).toEqual(1);
    await authorityConnection.getReceiveTruths()(twoTruthEvents);
    expectConnectionEventIds(scribeConnection, 0, 3, 4);

    const lastEntry = authorityConnection._proclamations.splice(0, 1);
    const lastTruthEvents = lastEntry.map(entry => roundtripEvent(entry.event));
    // skip resolveTruthEvent - rely on downstream push via getReceiveTruths
    // lastEntry[0].resolveTruthEvent(coupleCommands[1]);
    await authorityConnection.getReceiveTruths()(lastTruthEvents);
    expectConnectionEventIds(scribeConnection, 0, 4, 4);

    expect(await secondsTruthProcesses[1]).toMatchObject(coupleCommands[1]);
    expect(secondsTruths.length).toEqual(2);
  });

  it("resolves getTruthEvent when a command is reordered and others rejected", async () => {
    const { scribeConnection, authorityConnection } =
        await setUp({ isRemoteAuthority: true, isLocallyRecorded: true }, { verbosity: 0 });
    const plog1 = harness.opLog(1, "resolve-reorder-reject", "Harness created");

    const purgedHeresies = [];
    // Purge all heresies
    const onReform = (reformEvent) => {
      purgedHeresies.push(reformEvent.prophecy);
      reformEvent.isSchismatic = true;
      reformEvent.isReformable = false;
    };

    expectConnectionEventIds(scribeConnection, 0, 1, 1);

    const first = harness.proclaimTestEvent(simpleCommand, { onReform });
    expect(first.getLogAspectOf(harness.testChronicleURI).index).toEqual(1);

    let firstTruth, firstFailure;
    const firstTruthProcess = first.getTruthEvent()
        .then(truthEvent_ => (firstTruth = truthEvent_), failure => (firstFailure = failure));

    plog1 && plog1.opEvent("first.getRecordedEvent");
    await first.getRecordedEvent();

    expect(firstTruth).toEqual(undefined);

    const seconds = harness.proclaimTestEvents(coupleCommands, { onReform }).eventResults;

    const secondsTruths = [], secondsFailures = [];
    const secondsTruthProcesses = seconds.map((result_, index) => result_.getTruthEvent().then(
            truthEvent_ => (secondsTruths[index] = truthEvent_),
            failure => (secondsFailures[index] = failure)));

    plog1 && plog1.opEvent("seconds[1].getRecordedEvent");
    await seconds[1].getRecordedEvent();
    expectConnectionEventIds(scribeConnection, 0, 1, 4);

    expect(firstTruth).toEqual(undefined);
    expect(secondsTruths.length).toEqual(0);
    expect(secondsTruths[0]).toEqual(undefined);
    expect(secondsTruths[1]).toEqual(undefined);

    // Remove the first entry.
    authorityConnection._proclamations.splice(0, 1);

    const oneEntries = authorityConnection._proclamations.splice(0, 1);
    const oneTruthEvent = oneEntries.map(entry => roundtripEvent(entry.event));
    obtainAspect(oneTruthEvent[0], "log").index = 1;
    // The original third entry is now malformed, don't confirm it.
    authorityConnection._proclamations.splice(0, 1);
    oneEntries[0].resolveTruthEvent(oneTruthEvent[0]);
    // Mismatching log.index's between sent commands and incoming truths
    // will inhibit prophecy chronicle command reproclaims and will
    // delay prophecy resolutions but otherwise has no other effect.
    expect(secondsTruths.length).toEqual(0);
    expectConnectionEventIds(scribeConnection, 0, 1, 4);
    plog1 && plog1.opEvent("getReceiveTruths(oneTruthEvent)");
    await authorityConnection.getReceiveTruths()(oneTruthEvent);
    expectConnectionEventIds(scribeConnection, 0, 2, 2);

    expect(purgedHeresies.length).toEqual(2);

    plog1 && plog1.opEvent("firstTruthProcess");
    await firstTruthProcess;
    expect(firstFailure).not.toEqual(undefined);

    plog1 && plog1.opEvent("secondsTruthProcesses[0]");
    await secondsTruthProcesses[0];
    plog1 && plog1.opEvent("secondsTruthProcesses[1]");
    await secondsTruthProcesses[1];

    expect(seconds[0].getLogAspectOf(harness.testChronicleURI).index).toEqual(1);
    expect(seconds[1].getCommandOf(harness.testChronicleURI)).toEqual(null);
    expect(secondsTruths.length).toEqual(1);
    expect(secondsFailures.length).toEqual(2);
    expect(secondsFailures[0]).toEqual(undefined);

    // Re-chronicle manually

    const recommands = [...purgedHeresies].map(getActionFromPassage);

    const reproclaimResults = harness.proclaimTestEvents(recommands).eventResults;
    plog1 && plog1.opEvent("reproclaimResults[0].getRecordedEvent");
    expect(await reproclaimResults[0].getRecordedEvent()).toMatchObject(simpleCommand);
    plog1 && plog1.opEvent("reproclaimResults[1].getRecordedEvent");
    expect(await reproclaimResults[1].getRecordedEvent()).toMatchObject(coupleCommands[1]);

    expectConnectionEventIds(scribeConnection, 0, 2, 4);

    // Check that first command has been properly revised and resent
    expect(reproclaimResults[0].getLogAspectOf(harness.testChronicleURI).index).toEqual(2);
    expect(authorityConnection._proclamations.length).toEqual(2);

    const lastEntry = authorityConnection._proclamations.splice(0, 2);
    const lastTruthEvents = lastEntry.map(entry => roundtripEvent(entry.event));
    // skip resolveTruthEvent - rely on downstream push only via getReceiveTruths
    // lastEntry[0].resolveTruthEvent(coupleCommands[1]);
    plog1 && plog1.opEvent("getReceiveTruths(lastTruthEvents)");
    await authorityConnection.getReceiveTruths()(lastTruthEvents);
    expectConnectionEventIds(scribeConnection, 0, 4, 4);

    plog1 && plog1.opEvent("reproclaimResults[0].getTruthEvent");
    expect(await reproclaimResults[0].getTruthEvent()).toMatchObject(simpleCommand);
    plog1 && plog1.opEvent("reproclaimResults[1].getTruthEvent");
    expect(await reproclaimResults[1].getTruthEvent()).toMatchObject(coupleCommands[1]);

    expect(harness.run(vRef("simple_entity"),
            VALK.toField("relations").toIndex(0).toField("target").toField("name")))
        .toEqual("Simple Media");
  });

  it("resolves getTruthEvent when a command is reordered and others revised", async () => {
    const { scribeConnection, authorityConnection } =
        await setUp({ isRemoteAuthority: true, isLocallyRecorded: true }, { verbosity: 0 });
    const plog1 = harness.opLog(1, "resolve-getTruthEvent-reorder-revise", "Harness created");

    // Repeat the steps of the previous test case...
    const first = harness.proclaimTestEvent(simpleCommand);
    let firstTruth, firstFailure;
    const firstTruthProcess = first.getTruthEvent()
        .then(truthEvent_ => (firstTruth = truthEvent_), failure => (firstFailure = failure));
    plog1 && plog1.opEvent("first.getRecordedEvent");
    await first.getRecordedEvent();
    const seconds = harness.proclaimTestEvents(coupleCommands).eventResults;
    const secondsTruths = [], secondsFailures = [];
    const secondsTruthProcesses = seconds.map((result_, index) => result_.getTruthEvent().then(
        truthEvent_ => (secondsTruths[index] = truthEvent_),
        failure => (secondsFailures[index] = failure)));
    plog1 && plog1.opEvent("seconds[1].getRecordedEvent");
    await seconds[1].getRecordedEvent();
    const secondsFirstEntries = authorityConnection._proclamations.splice(1, 1);
    authorityConnection._proclamations = [];
    const secondsFirstTruth = secondsFirstEntries.map(entry => roundtripEvent(entry.event));
    obtainAspect(secondsFirstTruth[0], "log").index = 1; // reordering from index = 2
    secondsFirstEntries[0].resolveTruthEvent(secondsFirstTruth[0]);
    plog1 && plog1.opEvent("auth.getReceiveTruths(secondsFirstTruth)");
    await authorityConnection.getReceiveTruths()(secondsFirstTruth);
    // ...until a divergence due to revise-instead-of-reject happens here.
    plog1 && plog1.opEvent("seconds[0].getTruthEvent");
    await seconds[0].getTruthEvent();
    expect(seconds[0].getLogAspectOf(harness.testChronicleURI).index).toEqual(1);
    expectConnectionEventIds(scribeConnection, 0, 2, 4);
    expect(first.getLogAspectOf(harness.testChronicleURI).index).toEqual(2);
    expect(seconds[1].getLogAspectOf(harness.testChronicleURI).index).toEqual(3);
    plog1 && plog1.opEvent("seconds[1].getRecordedEvent");
    await seconds[1].getRecordedEvent();

    expect(authorityConnection._proclamations.length).toEqual(2);
    const stageTwoEntries = authorityConnection._proclamations.splice(0, 2)
        .map(entry => roundtripEvent(entry.event));
    expect(stageTwoEntries[0].aspects.log.index).toEqual(2);
    expect(stageTwoEntries[1].aspects.log.index).toEqual(3);
    plog1 && plog1.opEvent("auth.getReceivedTruths(stageTwoEntries)");
    await authorityConnection.getReceiveTruths()(stageTwoEntries);
    expectConnectionEventIds(scribeConnection, 0, 4, 4);

    plog1 && plog1.opEvent("firstTruthProcess");
    await firstTruthProcess;
    expect(firstTruth).toMatchObject(simpleCommand);
    expect(firstFailure).toEqual(undefined);
    expect(first.getCommandOf(harness.testChronicleURI)).toMatchObject(stageTwoEntries[0]);

    plog1 && plog1.opEvent("secondsTruthProcesses[0]");
    await secondsTruthProcesses[0];
    plog1 && plog1.opEvent("secondsTruthProcesses[1]");
    await secondsTruthProcesses[1];
    expect(seconds[0].getLogAspectOf(harness.testChronicleURI).index).toEqual(1);
    expect(roundtripEvent(seconds[1].getCommandOf(harness.testChronicleURI)))
        .toMatchObject(stageTwoEntries[1]);

    expect(secondsTruths.length).toEqual(2);
    expect(secondsFailures.length).toEqual(0);
  });

  it("reviews prophecies and resolves getTruthEvent with incoming foreign truths", async () => {
    const { scribeConnection, authorityConnection } =
        await setUp({ isRemoteAuthority: true, isLocallyRecorded: true }, { verbosity: 0 });

    // Repeat the steps of the previous test case...
    const first = harness.proclaimTestEvent(simpleCommand);
    let firstTruth, firstFailure;
    const firstTruthProcess = first.getTruthEvent()
        .then(truthEvent_ => (firstTruth = truthEvent_), failure => (firstFailure = failure));
    await first.getRecordedEvent();
    const seconds = harness.proclaimTestEvents(coupleCommands).eventResults;
    const secondsTruths = [], secondsFailures = [];
    const secondsTruthProcesses = seconds.map((result_, index) => result_.getTruthEvent().then(
            truthEvent_ => (secondsTruths[index] = truthEvent_),
            failure => (secondsFailures[index] = failure)));
    await seconds[1].getRecordedEvent();
    expectConnectionEventIds(scribeConnection, 0, 1, 4);
    expect(authorityConnection._proclamations.length).toEqual(3);
    authorityConnection._proclamations = [];
    const foreignTruth = initializeAspects(created({
      id: ["foreign_entity"], typeName: "Entity", initialState: {
        name: "Simple Entity", owner: [testRootId],
      },
    }), { version: "0.2", command: { id: "foreign_entity" }, log: { index: 1 } });
    await authorityConnection.getReceiveTruths()([foreignTruth]);
    await seconds[1].getRecordedEvent();
    expectConnectionEventIds(scribeConnection, 0, 2, 5);

    expect(authorityConnection._proclamations.length).toEqual(3);
    const stageTwoEntries = authorityConnection._proclamations.splice(0, 3)
        .map(entry => roundtripEvent(entry.event));
    expect(stageTwoEntries[0].aspects.log.index).toEqual(2);
    expect(stageTwoEntries[1].aspects.log.index).toEqual(3);
    expect(stageTwoEntries[2].aspects.log.index).toEqual(4);
    await authorityConnection.getReceiveTruths()(stageTwoEntries);
    expectConnectionEventIds(scribeConnection, 0, 5, 5);

    await firstTruthProcess;
    expect(firstTruth).toMatchObject(simpleCommand);
    expect(firstFailure).toEqual(undefined);
    expect(first.getCommandOf(harness.testChronicleURI)).toMatchObject(stageTwoEntries[0]);

    await secondsTruthProcesses[0];
    await secondsTruthProcesses[1];
    expect(JSON.parse(JSON.stringify(seconds[0].getCommandOf(harness.testChronicleURI))))
        .toMatchObject(stageTwoEntries[1]);
    expect(JSON.parse(JSON.stringify(seconds[1].getCommandOf(harness.testChronicleURI))))
        .toMatchObject(stageTwoEntries[2]);

    expect(secondsTruths.length).toEqual(2);
    expect(secondsFailures.length).toEqual(0);
  });

  it("rejects a prophecy for which its proclaimEvents throws naively", async () => {
    const { scribeConnection, authorityConnection } =
        await setUp({ isRemoteAuthority: true, isLocallyRecorded: true }, { verbosity: 0 });
    const plog1 = harness.opLog(1, "reject-prophecy-on-throw", "Harness created");

    const results = harness.proclaimTestEvents([
      simpleCommand,
      created({
        id: ["followup_entity"], typeName: "Entity", initialState: {
          name: "Followup Entity", owner: [testRootId, {}, {}],
        }
      }),
    ]).eventResults;

    const truths = [], failures = [];
    const truthProcesses = results.map((result_, index) => result_.getTruthEvent().then(
            truthEvent_ => (truths[index] = truthEvent_),
            failure => (failures[index] = failure)));

    plog1 && plog1.opEvent("1.await.recorded");

    await results[1].getRecordedEvent();
    expect(results[1].getLogAspectOf(harness.testChronicleURI).index)
        .toEqual(2);

    expect(harness.run(vRef("simple_entity"), ["§->", "name"]))
        .toEqual("Simple Entity");
    expect(harness.run(vRef("followup_entity"), ["§->", "name"]))
        .toEqual("Followup Entity");
    expectConnectionEventIds(scribeConnection, 0, 1, 3);
    expect(authorityConnection._proclamations.length).toEqual(2);

    const twoEntries = authorityConnection._proclamations.splice(0, 2);

    plog1 && plog1.opEvent("2.reject-truth.0.not-permitted");

    twoEntries[0].rejectTruthEvent(
        Object.assign(new Error("Not permitted"), { isRevisable: false, isReformable: false }));

    plog1 && plog1.opEvent("2.reject-truth.1.revise-reorder");

    twoEntries[1].rejectTruthEvent(
        Object.assign(new Error("revise: reorder"), { isRevisable: false, isReformable: true }));

    plog1 && plog1.opEvent("2.await.not-permitted");

    await expect(results[0].getTruthEvent()).rejects
        .toThrow(/Not permitted/);
    expect(failures.length === 1);
    expect(truths.length === 0);
    expectConnectionEventIds(scribeConnection, 0, 1, 2);

    plog1 && plog1.opEvent("3.await.recorded");

    await results[1].getRecordedEvent();
    expect(results[1].getLogAspectOf(harness.testChronicleURI).index)
        .toEqual(1);
    expect(authorityConnection._proclamations.length).toEqual(1);

    expect(() => harness.run(vRef("simple_entity"), ["§->", "name"]))
        .toThrow(/Could not find non-ghost.*simple_entity/);
    expect(harness.run(vRef("followup_entity"), ["§->", "name"]))
        .toEqual("Followup Entity");

    expect(truths.length === 0);

    const revisedEntry = authorityConnection._proclamations.splice(0, 1)[0];

    plog1 && plog1.opEvent("4.resolve-truth.revisedEntry");

    revisedEntry.resolveTruthEvent(roundtripEvent(revisedEntry.event));

    plog1 && plog1.opEvent("5.await.all-truths");

    await Promise.all(truthProcesses);
    expectConnectionEventIds(scribeConnection, 0, 2, 2);
    expect(failures[0].message)
        .toEqual(expect.stringMatching(/Not permitted/));
    expect(truths[1].meta.chronicles[String(harness.testChronicleURI)].truth.aspects.log.index)
        .toEqual(1);

    plog1 && plog1.opEvent("6.await.truth-processes");

    await results[1].getTruthEvent();
    expect(results[1].getLogAspectOf(harness.testChronicleURI).index)
        .toEqual(1);

    expect(() => harness.run(vRef("simple_entity"), ["§->", "name"]))
        .toThrow(/Could not find non-ghost.*simple_entity/);
    expect(harness.run(vRef("followup_entity"), ["§->", "name"]))
        .toEqual("Followup Entity");
  });
});

describe("Cross-chronicle", () => {
  it("handles out-of-order cross-chronicle incomingRelations", async () => {
    const { scribeConnection } =
        await setUp({ isRemoteAuthority: true, isLocallyRecorded: true }, { verbosity: 0 });
    const lateChronicleURI = naiveURI.createChronicleURI(
        harness.testAuthorityURI, "@$~raw.test_late@@");

    const lateTargetId = vRef("late_target", undefined, undefined, lateChronicleURI);

    await scribeConnection.proclaimEvent(created({
      id: ["CrossRelation_A"], typeName: "Relation",
      initialState: {
        source: [testRootId], name: "CrossRelation", target: lateTargetId.toJSON(),
      },
      aspects: {
        version: "0.2",
        log: { index: scribeConnection.getFirstUnusedCommandEventId() },
        command: { id: "cid-1" },
      },
    }), { isTruth: true }).getRecordedEvent();

    const lateConnection = harness.sourcerer.sourcerChronicle(lateChronicleURI);
    harness.tryGetTestAuthorityConnection(lateConnection).addNarrateResults({ eventIdBegin: 0 }, [
      created({
        id: ["@$~raw.test_late@@"], typeName: "Entity",
        initialState: { name: "Test Late" },
        aspects: { version: "0.2", log: { index: 0 }, command: { id: "lid-0" } },
      }),
      created({
        id: ["late_target"], typeName: "Entity",
        initialState: { name: "Late Target" },
        aspects: { version: "0.2", log: { index: 1 }, command: { id: "lid-1" } },
      }),
    ]);
    await lateConnection.asSourceredConnection();
    const incomingRelations = harness.run(lateTargetId, "incomingRelations");
    expect(incomingRelations.length)
        .toEqual(1);
  });

  it("handles out-of-order instantiation with properties in both chronicles", async () => {
    const { scribeConnection } =
        await setUp({ isRemoteAuthority: true, isLocallyRecorded: true }, { verbosity: 0 });
    const lateChronicleURI = naiveURI.createChronicleURI(
        harness.testAuthorityURI, "@$~raw.test_late@@");

    const latePrototypeId = vRef("late_prototype", undefined, undefined, lateChronicleURI);

    const index = scribeConnection.getFirstUnusedCommandEventId();
    await Promise.all(scribeConnection.proclaimEvents([
      created({
        id: ["CrossEntryInstance_A"], typeName: "Entity",
        initialState: { owner: [testRootId], instancePrototype: latePrototypeId.toJSON(),
          name: "Cross-chronicle instance",
        },
        aspects: { version: "0.2", log: { index: index + 0 }, command: { id: "cid-1" } },
      }),
      created({
        id: ["CrossEntryInstance_A-foo"], typeName: "Property",
        initialState: { owner: ["CrossEntryInstance_A", {}, { coupling: "properties" }],
          name: "bar",
        },
        aspects: { version: "0.2", log: { index: index + 1 }, command: { id: "cid-2" } },
      })], { isTruth: true }).eventResults.map(result => result.getRecordedEvent()));

    const lateConnection = harness.sourcerer.sourcerChronicle(lateChronicleURI);
    harness.tryGetTestAuthorityConnection(lateConnection).addNarrateResults({ eventIdBegin: 0 }, [
      created({
        id: ["@$~raw.test_late@@"], typeName: "Entity",
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
    await lateConnection.asSourceredConnection();

    const properties = harness.run(vRef("CrossEntryInstance_A"),
        ["§->", "properties", ["§map", "name"]]);
    expect(properties)
        .toEqual(["foo", "bar"]);
  });
});

describe("Disjoint clients using paired harnesses", () => {
  it("delivers commands from one harness as events to another harness", async () => {
    const { scribeConnection } = await setUp({ isRemoteAuthority: true, isLocallyRecorded: true },
        { verbosity: 0 });
    const pairness = await createSourcererOracleHarness({ verbosity: 0, pairedHarness: harness });
    const pairedConnection = pairness.sourcerer.sourcerChronicle(harness.testChronicleURI);

    const result = harness.proclaimTestEvent(created({
      id: ["multiharness-entity"], typeName: "Entity",
      initialState: { owner: [testRootId], name: "Multi-harness test entity" },
      aspects: { version: "0.2", log: {}, command: { id: "cid-1" } },
    }));
    await result.getRecordedEvent();
    expect((await pairness.receiveEventsFrom(harness, { verbosity: 0 })).length)
        .toEqual(1);
    expect(scribeConnection.getFirstCommandEventId())
        .toEqual(1);
    expect(pairedConnection.getUpstreamConnection().getFirstCommandEventId())
        .toEqual(2);
    expect((await harness.receiveEventsFrom(harness, { clearUpstreamEntries: true })).length)
        .toEqual(1);
    expect(scribeConnection.getFirstCommandEventId())
        .toEqual(2);
  });

  it("reorders conflicting commands between harnesses", async () => {
    await setUp({ isRemoteAuthority: true, isLocallyRecorded: true }, { verbosity: 0 });
    const pairness = await createSourcererOracleHarness({ verbosity: 0, pairedHarness: harness });
    await pairness.sourcerer.sourcerChronicle(harness.testChronicleURI);

    const result = harness.proclaimTestEvent(created({
      id: ["multiharness-entity"], typeName: "Entity",
      initialState: { owner: [testRootId], name: "Multi-harness test entity" },
      aspects: { version: "0.2", log: {}, command: { id: "cid-1" } },
    }));
    await result.getComposedEvent();
    expect(result.getCommandOf(harness.testChronicleURI).aspects.log.index)
        .toEqual(1);

    const pairedResult = pairness.proclaimTestEvent(created({
      id: ["pairedharness-entity"], typeName: "Entity",
      initialState: { owner: [testRootId], name: "Multi-harness distinct entity" },
      aspects: { version: "0.2", log: {}, command: { id: "cid-p-1" } },
    }));
    await pairedResult.getRecordedEvent();
    expect(pairedResult.getCommandOf(harness.testChronicleURI).aspects.log.index)
        .toEqual(1);
    // Make paired harness commands into truths first.
    expect((await harness.receiveEventsFrom(pairness, { clearReceiverUpstream: true })).length)
        .toEqual(1);
    expect((await pairness.receiveEventsFrom(pairness, { clearReceiverUpstream: true })).length)
        .toEqual(1);
    // Re-send reordered commands by harness.
    expect((await pairness.receiveEventsFrom(harness, { verbosity: 0 })).length)
        .toEqual(2);
    expect((await harness.receiveEventsFrom(harness, { clearReceiverUpstream: true })).length)
        .toEqual(2);
    expect(immutableIs(harness.corpus.getState(), pairness.corpus.getState()))
        .toEqual(true);
    expect(harness.run(vRef(testRootId), ["§->", "unnamedOwnlings", ["§map", "name"]]))
        .toEqual(["Multi-harness distinct entity", "Multi-harness test entity"]);
    expect(pairness.run(vRef(testRootId), ["§->", "unnamedOwnlings", ["§map", "name"]]))
        .toEqual(["Multi-harness distinct entity", "Multi-harness test entity"]);
  });
});
