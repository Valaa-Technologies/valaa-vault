import { created } from "~/raem/command/index";
import { vRef } from "~/raem/ValaaReference";
import { createPartitionURI } from "~/raem/ValaaURI";

import { createProphetOracleHarness } from "~/prophet/test/ProphetTestHarness";

const testAuthorityURI = "valaa-test:";
// const sharedURI = "valaa-shared-content";

let harness = null;
afterEach(async () => {
  if (harness) { await harness.cleanup(); harness = null; }
});

describe("FalseProphet", () => {

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

  it("assigns proper eventIds for proclamations", async () => {
    harness = await createProphetOracleHarness({});
    const partitionURI = createPartitionURI(testAuthorityURI, "test_partition");

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
/*
  it("Keeps track of the count of commands executed", async () => {
    // TODO(iridian): Move this test false prophet. Scribe no longer
    // tracks the pending commands.
    let commandsCounted = 0;
    const commandCountCallback = (count) => {
      commandsCounted = count;
    };

    const scribe = createScribe(commandCountCallback);
    await scribe.initialize();
    const uri = createPartitionURI(URI);

    expect(commandsCounted).toBe(0);

    const connection = await scribe.acquirePartitionConnection(uri).getSyncedConnection();
    expect(commandsCounted).toBe(0);

    await connection.chronicleEventLog([simpleCommand]).eventResults[0];
    expect(commandsCounted).toBe(1);

    // A transaction counts as one command
    await connection.chronicleEventLog([simpleTransaction]).eventResults[0];
    expect(commandsCounted).toBe(2);
  });
*/
});
