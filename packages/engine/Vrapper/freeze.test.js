// @flow

import { created, transacted, fieldsSet } from "~/raem/command/index";
import { vRef } from "~/raem/ValaaReference";
// import { createGhostRawId } from "~/raem/tools/denormalized/GhostPath";
import { createPartitionURI } from "~/raem/ValaaURI";

import VALEK from "~/engine/VALEK";
// import Vrapper from "~/engine/Vrapper";

import EngineTestHarness, { createEngineOracleHarness }
    from "~/engine/test/EngineTestHarness";

function vCrossRef (rawId, partitionRawId = rawId) {
  const uri = createPartitionURI("valaa-test:", partitionRawId);
  return vRef(rawId, null, null, uri);
}

let harness: EngineTestHarness;
afterEach(() => {
  if (harness) {
    harness.cleanup();
    harness = null;
  }
});
const entities = () => harness.createds.Entity;

describe("Partition freezing", () => {
  const transactionA = Object.freeze({
    type: "TRANSACTED",
    actions: [
      created({ id: vCrossRef("test_entity", "test_partition"), typeName: "Entity", initialState: {
        name: "Test Entity",
        owner: vRef("test_partition", "unnamedOwnlings"),
      }, }),
      created({ id: vCrossRef("test_entity.prop", "test_partition"), typeName: "Property",
        initialState: {
          name: "prop",
          owner: vRef("test_entity", "properties"),
          value: { typeName: "Literal", value: "This is some string", },
        },
      }),
    ]
  });

  const lateEntityEvent = created({
    id: vCrossRef("late_entity", "test_partition"), typeName: "Entity", initialState: {
      name: "Late Entity",
      owner: vRef("test_partition", "unnamedOwnlings"),
    },
  });

  const freezeEventFor = (entityRawId: string) => transacted({
    actions: [fieldsSet({ id: vRef(entityRawId), typeName: "Entity", sets: { isFrozen: true } })],
  });

  it("Allows the user to freeze a partition", async () => {
    harness = await createEngineOracleHarness({ claimBaseBlock: false }, [transactionA]);
    expect(entities().test_partition.get("isFrozen")).toBeFalsy();
    await harness.chronicleEvent(freezeEventFor("test_partition")).getPremiereStory();
    expect(entities().test_partition.get("isFrozen")).toBeTruthy();
    expect(harness.testPartitionConnection.isFrozenConnection()).toBeTruthy();
  });

  it("Does not allow the user to add contents to a frozen partition", async () => {
    harness = await createEngineOracleHarness({ claimBaseBlock: false }, [transactionA]);
    await harness.chronicleEvent(freezeEventFor("test_partition")).getPremiereStory();
    expect(() => harness.chronicleEvent(lateEntityEvent))
        .toThrow(/Cannot modify frozen.*test_partition/);
    expect(entities().late_entity).toBeFalsy();
  });

  it("Does not allow modifying properties of a frozen Entity", async () => {
    harness = await createEngineOracleHarness({ claimBaseBlock: false }, [transactionA]);
    await harness.chronicleEvent(freezeEventFor("test_entity")).getPremiereStory();
    expect(() => entities().test_entity.alterProperty("prop", VALEK.fromValue("Changed string")))
        .toThrow(/Cannot modify frozen.*test_entity/);
    expect(entities().test_entity.propertyValue("prop"))
        .toEqual("This is some string");
  });

  const transactionB = {
    type: "TRANSACTED",
    actions: [
      created({ id: vCrossRef("test_partition_b", "test_partition_b"), typeName: "Entity",
        initialState: {
          name: "Test Partition B",
          partitionAuthorityURI: "valaa-test:",
        }, }),
      created({ id: vCrossRef("test_entity_b", "test_partition_b"), typeName: "Entity",
        initialState: {
          name: "Test Entity B",
          owner: vRef("test_partition_b", "unnamedOwnlings"),
        },
      }),
      created({ id: vCrossRef("test_entity_b.prop_b", "test_partition_b"), typeName: "Property",
        initialState: {
          name: "prop_b",
          owner: vRef("test_entity_b", "properties"),
          value: { typeName: "Literal", value: "This is some string", },
        },
      }),
    ]
  };

  const lateEntityEventB = created({
    id: vCrossRef("late_entity_b", "test_partition_b"), typeName: "Entity", initialState: {
      name: "Another Late Entity",
      owner: vRef("test_partition_b", "unnamedOwnlings"),
    },
  });

  it("Does not prevent the user from editing non-frozen partitions", async () => {
    harness = await createEngineOracleHarness({
      verbosity: 0, claimBaseBlock: false, acquirePartitions: ["test_partition_b"],
    }, [transactionA, transactionB]);
    await harness.chronicleEvent(freezeEventFor("test_partition")).getPremiereStory();
    expect(() => harness.chronicleEvent(lateEntityEvent))
        .toThrow(/Cannot modify frozen.*test_partition/);
    expect(entities().late_entity).toBeFalsy();
    await harness.chronicleEvent(lateEntityEventB).getPremiereStory();
    expect(entities().late_entity_b).toBeTruthy();
  });
});
