// @flow

import { created } from "~/raem/events/index";
import { vRef } from "~/raem/VRL";

import {
  testRootId, testChronicleURI,
  createFalseProphet, createSourcererOracleHarness, createTestMockSourcerer,
  createdTestPartitionEntity, MockFollower,
} from "~/sourcerer/test/SourcererTestHarness";

let harness = null;
afterEach(async () => {
  if (harness) { await harness.cleanupScribe(); harness = null; }
});

const basicCommands = [
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

describe("FalseProphet", () => {
  it("assigns proper eventIds for chronicled commands", async () => {
    harness = await createSourcererOracleHarness({});

    const connection = await harness.sourcerer
        .acquireConnection(testChronicleURI).asActiveConnection();
    const scribeConnection = connection.getUpstreamConnection();

    let oldCommandId;
    let newCommandId = scribeConnection.getFirstUnusedCommandEventId() - 1;

    for (const command of basicCommands) {
      oldCommandId = newCommandId;

      await harness.chronicleEvent(command).getPremiereStory();

      newCommandId = scribeConnection.getFirstUnusedCommandEventId() - 1;
      expect(oldCommandId).toBeLessThan(newCommandId);
    }
  });

  it("keeps track of the count of commands executed", async () => {
    let commandsCounted = 0;
    const onCommandCountUpdate = (count) => { commandsCounted = count; };

    const falseProphet = createFalseProphet({
      verbosity: 0, onCommandCountUpdate,
      upstream: createTestMockSourcerer({ isLocallyPersisted: false, isRemoteAuthority: true }),
    });
    let connection = falseProphet.acquireConnection(testChronicleURI);
    connection.getUpstreamConnection().addNarrateResults({ eventIdBegin: 0 }, []);
    falseProphet.clockEvent(2, () => ["test.asActiveConnection"]);
    connection = await connection.asActiveConnection();
    expect(commandsCounted).toBe(0);
    const discourse = falseProphet.addFollower(new MockFollower());

    // A transaction counts as one command
    let resolveDelay;
    let delayer = new Promise(resolve => { resolveDelay = resolve; });
    falseProphet.setCommandNotificationBlocker(delayer);
    falseProphet.clockEvent(2, () =>
        ["test.chronicleEvent.createdTestPartitionEntity.getPremiereStory"]);
    await discourse.chronicleEvent(createdTestPartitionEntity).getPremiereStory();
    resolveDelay();
    falseProphet.clockEvent(2, () => ["test.pendingCommandNotification#1"]);
    await falseProphet._pendingCommandNotification;
    expect(commandsCounted).toBe(1);

    delayer = new Promise(resolve => { resolveDelay = resolve; });
    falseProphet.setCommandNotificationBlocker(delayer);
    const results = connection.chronicleEvents(basicCommands, { isProphecy: true });
    falseProphet.clockEvent(2, () => ["test.eventResults[2].event"]);
    const lastStoredEvent = await results.eventResults[2].event;
    expect(lastStoredEvent.aspects.log.index)
        .toEqual(3);
    resolveDelay();
    falseProphet.clockEvent(2, () => ["test.pendingCommandNotification#2"]);
    await falseProphet._pendingCommandNotification;
    expect(commandsCounted).toBe(4);
  });
});
