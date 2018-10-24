// @flow

import { created } from "~/raem/command/index";
import { vRef } from "~/raem/ValaaReference";
import { createPartitionURI } from "~/raem/ValaaURI";

import {
  createFalseProphet, createProphetOracleHarness, createTestMockProphet,
  proclamationCREATEDTestPartitionEntity,
} from "~/prophet/test/ProphetTestHarness";

import baseEventBlock from "~/engine/test/baseEventBlock";

const testAuthorityURI = "valaa-test:";
const partitionURI = createPartitionURI(testAuthorityURI, "test_partition");

let harness = null;
afterEach(async () => {
  if (harness) { await harness.cleanup(); harness = null; }
});

const basicProclamations = [
  created({
    id: "Entity A",
    typeName: "Entity",
    initialState: { name: "Entity A", owner: vRef("test_partition", "unnamedOwnlings") },
  }),
  created({
    id: "Entity B",
    typeName: "Entity",
    initialState: { name: "Entity B", owner: vRef("test_partition", "unnamedOwnlings") },
  }),
  created({
    id: "Entity C",
    typeName: "Entity",
    initialState: { name: "Entity C", owner: vRef("test_partition", "unnamedOwnlings") },
  }),
];

describe("FalseProphet", () => {
  it("assigns proper eventIds for proclamations", async () => {
    harness = await createProphetOracleHarness({});

    const prophetConnection = await harness.prophet
        .acquirePartitionConnection(partitionURI).getSyncedConnection();
    const scribeConnection = prophetConnection.getUpstreamConnection();

    let oldCommandId;
    let newCommandId = scribeConnection.getFirstUnusedCommandEventId() - 1;

    for (const proclamation of basicProclamations) {
      oldCommandId = newCommandId;

      const claimResult = await harness.proclaim(proclamation);
      await claimResult.getStoryPremiere();

      newCommandId = scribeConnection.getFirstUnusedCommandEventId() - 1;
      expect(oldCommandId).toBeLessThan(newCommandId);
    }
  });

  it("Keeps track of the count of commands executed", async () => {
    // TODO(iridian): Move this test false prophet. Scribe no longer
    // tracks the pending commands.
    let commandsCounted = 0;
    const commandCountCallback = (count) => { commandsCounted = count; };

    const falseProphet = createFalseProphet({
      commandCountCallback, upstream: createTestMockProphet({ isPrimaryAuthority: false }),
    });
    const connection = await falseProphet
        .acquirePartitionConnection(partitionURI).getSyncedConnection();
    expect(commandsCounted).toBe(0);

    // A transaction counts as one command
    await falseProphet.proclaim(proclamationCREATEDTestPartitionEntity).getFinalStory();
    expect(commandsCounted).toBe(1);

    await connection.chronicleEvents(basicProclamations).eventResults[2];
    expect(commandsCounted).toBe(4);
  });
});
