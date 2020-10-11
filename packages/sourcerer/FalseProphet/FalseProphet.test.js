// @flow

import { created } from "~/raem/events/index";
import { vRef } from "~/raem/VRL";

import {
  testRootId, testChronicleURI,
  createFalseProphet, createSourcererOracleHarness, createTestMockSourcerer,
  createTestChronicleEntityCreated, MockFollower,
} from "~/sourcerer/test/SourcererTestHarness";

let harness = null;
let basicCommands;
beforeEach(() => {
  basicCommands = [
    created({
      id: ["Entity-A"],
      typeName: "Entity",
      initialState: { name: "Entity A", owner: vRef(testRootId, "unnamedOwnlings") },
    }),
    created({
      id: ["Entity-B"],
      typeName: "Entity",
      initialState: { name: "Entity B", owner: vRef(testRootId, "unnamedOwnlings") },
    }),
    created({
      id: ["Entity-C"],
      typeName: "Entity",
      initialState: { name: "Entity C", owner: vRef(testRootId, "unnamedOwnlings") },
    }),
  ];
});
afterEach(async () => {
  if (harness) { await harness.cleanupScribe(); harness = null; }
});

describe("FalseProphet", () => {
  it("assigns proper eventIds for proclaimed commands", async () => {
    harness = await createSourcererOracleHarness({ verbosity: 0 });

    const connection = await harness.sourcerer
        .sourcifyChronicle(testChronicleURI).asSourceredConnection();
    const scribeConnection = connection.getUpstreamConnection();

    let oldCommandId;
    let newCommandId = scribeConnection.getFirstUnusedCommandEventId() - 1;

    for (const command of basicCommands) {
      oldCommandId = newCommandId;

      await harness.proclaimTestEvent(command).getPremiereStory();

      newCommandId = scribeConnection.getFirstUnusedCommandEventId() - 1;
      expect(oldCommandId).toBeLessThan(newCommandId);
    }
  });

  xit("keeps track of the count of commands executed", async () => {
    let commandsCounted = 0;
    const onCommandCountUpdate = (count) => { commandsCounted = count; };

    const falseProphet = createFalseProphet({
      verbosity: 0, onCommandCountUpdate,
      upstream: createTestMockSourcerer({ isLocallyRecorded: false, isRemoteAuthority: true }),
    });
    let connection = falseProphet.sourcifyChronicle(testChronicleURI);
    connection.getUpstreamConnection().addNarrateResults({ eventIdBegin: 0 }, []);
    const plog2 = falseProphet.opLog(2, "test_keep-track");
    plog2 && plog2.opEvent("await_asActiveConnection");
    connection = await connection.asSourceredConnection();
    expect(commandsCounted).toBe(0);
    const discourse = falseProphet.addFollower(new MockFollower());

    // A transaction counts as one command
    let resolveDelay;
    let delayer = new Promise(resolve => { resolveDelay = resolve; });
    falseProphet.setCommandNotificationBlocker(delayer);
    plog2 && plog2.opEvent("await_testChronicleEntity-getPremiereStory");
    await discourse.proclaimEvent(createTestChronicleEntityCreated()).getPremiereStory();
    resolveDelay();
    plog2 && plog2.opEvent("await_pendingCommandNotification#1");
    await falseProphet._pendingCommandNotification;
    expect(commandsCounted).toBe(1);

    delayer = new Promise(resolve => { resolveDelay = resolve; });
    falseProphet.setCommandNotificationBlocker(delayer);
    const results = connection.proclaimEvents(basicCommands, { isProphecy: true });
    plog2 && plog2.opEvent("await_eventResults[2]-event");
    const lastStoredEvent = await results.eventResults[2].event;
    expect(lastStoredEvent.aspects.log.index)
        .toEqual(3);
    resolveDelay();
    plog2 && plog2.opEvent("await_pendingCommandNotification#2");
    await falseProphet._pendingCommandNotification;
    expect(commandsCounted).toBe(4);
  });
});
