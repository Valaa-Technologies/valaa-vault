// @flow

import { created } from "~/raem/events/index";
import { vRef } from "~/raem/VRL";
import { naiveURI } from "~/raem/ValaaURI";

import {
  createFalseProphet, createSourcererOracleHarness, createTestMockSourcerer,
  createdTestPartitionEntity, MockFollower,
} from "~/prophet/test/SourcererTestHarness";

const testAuthorityURI = "valaa-test:";
const partitionURI = naiveURI.createPartitionURI(testAuthorityURI, "test_partition");

let harness = null;
afterEach(async () => {
  if (harness) { await harness.cleanupScribe(); harness = null; }
});

const basicCommands = [
  created({
    id: ["Entity-A"],
    typeName: "Entity",
    initialState: { name: "Entity A", owner: vRef("test_partition", "unnamedOwnlings") },
  }),
  created({
    id: ["Entity-B"],
    typeName: "Entity",
    initialState: { name: "Entity B", owner: vRef("test_partition", "unnamedOwnlings") },
  }),
  created({
    id: ["Entity-C"],
    typeName: "Entity",
    initialState: { name: "Entity C", owner: vRef("test_partition", "unnamedOwnlings") },
  }),
];

describe("FalseProphet", () => {
  it("assigns proper eventIds for chronicled commands", async () => {
    harness = await createSourcererOracleHarness({});

    const connection = await harness.sourcerer
        .acquireConnection(partitionURI).asActiveConnection();
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
      onCommandCountUpdate,
      upstream: createTestMockSourcerer({ isLocallyPersisted: false, isRemoteAuthority: true }),
    });
    let connection = falseProphet.acquireConnection(partitionURI);
    connection.getUpstreamConnection().addNarrateResults({ eventIdBegin: 0 }, []);
    connection = await connection.asActiveConnection();
    expect(commandsCounted).toBe(0);
    const discourse = falseProphet.addFollower(new MockFollower());

    // A transaction counts as one command
    let resolveDelay;
    let delayer = new Promise(resolve => { resolveDelay = resolve; });
    falseProphet.setCommandNotificationBlocker(delayer);
    await discourse.chronicleEvent(createdTestPartitionEntity).getPremiereStory();
    resolveDelay();
    await falseProphet._pendingCommandNotification;
    expect(commandsCounted).toBe(1);

    delayer = new Promise(resolve => { resolveDelay = resolve; });
    falseProphet.setCommandNotificationBlocker(delayer);
    const results = connection.chronicleEvents(basicCommands, { isProphecy: true });
    const lastStoredEvent = await results.eventResults[2].event;
    expect(lastStoredEvent.aspects.log.index)
        .toEqual(3);
    resolveDelay();
    await falseProphet._pendingCommandNotification;
    expect(commandsCounted).toBe(4);
  });
});
