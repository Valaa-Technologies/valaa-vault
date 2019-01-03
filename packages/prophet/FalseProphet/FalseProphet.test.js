// @flow

import { created } from "~/raem/events/index";
import { vRef } from "~/raem/ValaaReference";
import { createPartitionURI } from "~/raem/ValaaURI";

import {
  createFalseProphet, createProphetOracleHarness, createTestMockProphet,
  createdTestPartitionEntity,
} from "~/prophet/test/ProphetTestHarness";

const testAuthorityURI = "valaa-test:";
const partitionURI = createPartitionURI(testAuthorityURI, "test_partition");

let harness = null;
afterEach(async () => {
  if (harness) { await harness.cleanup(); harness = null; }
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
    harness = await createProphetOracleHarness({});

    const prophetConnection = await harness.prophet
        .acquirePartitionConnection(partitionURI).getActiveConnection();
    const scribeConnection = prophetConnection.getUpstreamConnection();

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
      onCommandCountUpdate, upstream: createTestMockProphet({
        isLocallyPersisted: false, isRemoteAuthority: true,
      }),
    });
    const connection = await falseProphet
        .acquirePartitionConnection(partitionURI).getActiveConnection();
    expect(commandsCounted).toBe(0);

    // A transaction counts as one command
    let resolveDelay;
    let delayer = new Promise(resolve => { resolveDelay = resolve; });
    falseProphet.setCommandNotificationDelayer(delayer);
    await falseProphet.chronicleEvent(createdTestPartitionEntity).getPremiereStory();
    resolveDelay();
    await falseProphet._mostRecentNotification;
    expect(commandsCounted).toBe(1);

    delayer = new Promise(resolve => { resolveDelay = resolve; });
    falseProphet.setCommandNotificationDelayer(delayer);
    const results = connection.chronicleEvents(basicCommands, { isProphecy: true });
    const lastStoredEvent = await results.eventResults[2].event;
    expect(lastStoredEvent.aspects.log.index)
        .toEqual(3);
    resolveDelay();
    await falseProphet._mostRecentNotification;
    expect(commandsCounted).toBe(4);
  });
});
