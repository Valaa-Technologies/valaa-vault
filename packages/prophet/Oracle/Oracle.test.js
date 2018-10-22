import { created, transacted, fieldsSet } from "~/raem/command/index";
import { vRef } from "~/raem/ValaaReference";
import { createPartitionURI } from "~/raem/ValaaURI";

import { createProphetOracleHarness } from "~/prophet/test/ProphetTestHarness";

const testAuthorityURI = "valaa-test:";
// const sharedURI = "valaa-shared-content";

let harness = null;
afterEach(() => { if (harness) harness.cleanup(); harness = null; });

describe("Oracle", () => {
  it("sets up a connection and creates a partition", async () => {
    harness = await createProphetOracleHarness({});
    expect(harness.testPartitionConnection).toBeTruthy();
    expect(harness.testPartitionConnection.isConnected())
        .toEqual(true);
    expect(harness.run(vRef("test_partition"), "name"))
        .toEqual("Automatic Test Partition Root");
  });

  const basicCommands = [
    created({
      id: "Entity A",
      typeName: "Entity",
      initialState: {
        name: "Entity A",
        owner: vRef("test_partition", "unnamedOwnlings"),
      }
    }),
    created({
      id: "Entity B",
      typeName: "Entity",
      initialState: {
        name: "Entity B",
        owner: vRef("test_partition", "unnamedOwnlings"),
      }
    }),
    created({
      id: "Entity C",
      typeName: "Entity",
      initialState: {
        name: "Entity C",
        owner: vRef("test_partition", "unnamedOwnlings"),
      }
    }),
  ];

  it("counts prophet actions correctly on the scribe", async () => {
    harness = await createProphetOracleHarness({});
    const partitionURI = createPartitionURI(testAuthorityURI, "test_partition");

    const prophetConnection = await harness.prophet
        .acquirePartitionConnection(partitionURI).getSyncedConnection();
    // Wrong:
    // const scribeConnection = await scribe
    //     .acquirePartitionConnection(partitionURI).getSyncedConnection();
    //
    // Right:
    const scribeConnection = prophetConnection.getUpstreamConnection().getScribeConnection();

    let oldCommandId;
    let newCommandId = scribeConnection.getFirstUnusedCommandEventId() - 1;

    const commandList = [createPartitionCommand].concat(...basicCommands);
    for (const command of commandList) {
      oldCommandId = newCommandId;

      const claimResult = await harness.claim(command);
      await claimResult.getFinalEvent();

      newCommandId = scribeConnection.getFirstUnusedCommandEventId() - 1;
      expect(oldCommandId).toBeLessThan(newCommandId);
    }
  });

  it("Stores the contents of the actions on the scribe correctly", async () => {
    harness = await createProphetOracleHarness({});
    const partitionURI = createPartitionURI(testAuthorityURI, "test_partition");

    const prophetConnection = await harness.prophet
        .acquirePartitionConnection(partitionURI).getSyncedConnection();
    const scribeConnection = prophetConnection.getUpstreamConnection().getScribeConnection();
    const database = await openDB(partitionURI.toString());

    const commandList = [createPartitionCommand].concat(...basicCommands);
    for (const command of commandList) {
      const claimResult = await harness.claim(command);
      const finalEvent = await claimResult.getFinalEvent();
      const eventId = scribeConnection.getFirstUnusedCommandEventId() - 1;
      await expectStoredInDB(finalEvent, database, "commands", eventId);
    }
  });
  const freezePartitionProclamation = transacted({
    actions: [fieldsSet({ id: vRef("test_partition"), typeName: "Entity" }, { isFrozen: true })],
  });

  const lateProclamation = created({
    id: "Entity Late",
    typeName: "Entity",
    initialState: {
      name: "A late entity",
      owner: vRef("test_partition", "unnamedOwnlings"),
    }
  });

  it("Rejects proclamations executed after a freeze proclamations", async () => {
    harness = await createProphetOracleHarness({});
    const partitionURI = createPartitionURI(testAuthorityURI, "test_partition");
    await harness.prophet
        .acquirePartitionConnection(partitionURI).getSyncedConnection();

    // Run proclamations up until the partition is frozen
    const proclamationUntilFreeze = [freezePartitionProclamation];
    for (const proclamation of proclamationUntilFreeze) {
      const claimResult = await harness.proclaim(proclamation);
      await claimResult.getStoryPremiere();
    }

    // Attempt to run an action post-freeze and expect complaints
    expect(() => harness.proclaim(lateProclamation))
        .toThrow(/Cannot modify frozen.*test_partition/);
  });
});
