import { created, transacted, fieldsSet } from "~/raem/events/index";
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

  const freezePartitionEvent = transacted({
    actions: [
      fieldsSet({ id: vRef("test_partition"), typeName: "Entity", sets: { isFrozen: true } })],
  });

  const lateCommand = created({
    id: "Entity Late",
    typeName: "Entity",
    initialState: {
      name: "A late entity",
      owner: vRef("test_partition", "unnamedOwnlings"),
    }
  });

  it("Rejects commands chronicled after a freeze command", async () => {
    harness = await createProphetOracleHarness({});
    const partitionURI = createPartitionURI(testAuthorityURI, "test_partition");
    await harness.prophet
        .acquirePartitionConnection(partitionURI).getSyncedConnection();

    const commandsUpToFreeze = [freezePartitionEvent];
    for (const command of commandsUpToFreeze) {
      await harness.chronicleEvent(command).getPremiereStory();
    }

    // Attempt to run an action post-freeze and expect complaints
    expect(() => harness.chronicleEvent(lateCommand))
        .toThrow(/Cannot modify frozen.*test_partition/);
  });
});
