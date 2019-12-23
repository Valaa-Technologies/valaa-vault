import { created, transacted, fieldsSet } from "~/raem/events/index";
import { vRef } from "~/raem/VRL";
import { naiveURI } from "~/raem/ValaaURI";

import { createSourcererOracleHarness, testRootId } from "~/sourcerer/test/SourcererTestHarness";

const testAuthorityURI = "valaa-test:";
// const sharedURI = "valos-shared-content";

let harness = null;
afterEach(() => { if (harness) harness.cleanupScribe(); harness = null; });

describe("Oracle", () => {
  it("sets up a connection and creates a partition", async () => {
    harness = await createSourcererOracleHarness({});
    expect(harness.testConnection).toBeTruthy();
    expect(harness.testConnection.isConnected())
        .toEqual(true);
    expect(harness.run(vRef(testRootId), "name"))
        .toEqual("Automatic Test Partition Root");
  });

  const freezePartitionEvent = transacted({
    actions: [
      fieldsSet({
        id: vRef(testRootId), typeName: "Entity",
        sets: { isFrozen: true },
      })],
  });

  const lateCommand = created({
    id: ["Entity-Late"],
    typeName: "Entity",
    initialState: {
      name: "A late entity",
      owner: vRef(testRootId, "unnamedOwnlings"),
    }
  });

  it("Rejects commands chronicled after a freeze command", async () => {
    harness = await createSourcererOracleHarness({});
    const partitionURI = naiveURI.createChronicleURI(testAuthorityURI, testRootId);
    await harness.sourcerer
        .acquireConnection(partitionURI).asActiveConnection();

    const commandsUpToFreeze = [freezePartitionEvent];
    for (const command of commandsUpToFreeze) {
      await harness.chronicleEvent(command).getPremiereStory();
    }

    // Attempt to run an action post-freeze and expect complaints
    expect(() => harness.chronicleEvent(lateCommand))
        .toThrow(/Cannot modify frozen.*@\$~raw:test_chronicle@@/);
  });
});
