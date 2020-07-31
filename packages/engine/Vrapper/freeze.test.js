// @flow

import { vRef } from "~/raem/VRL";
import { naiveURI } from "~/raem/ValaaURI";

import { created, transacted, fieldsSet } from "~/raem/events/index";

import EngineTestHarness, { testRootId, createEngineOracleHarness }
    from "~/engine/test/EngineTestHarness";

function vCrossRef (rawId, chronicleId = rawId) {
  const uri = naiveURI.createChronicleURI("valaa-test:", chronicleId);
  return vRef(rawId, null, null, uri);
}

let harness: EngineTestHarness;
afterEach(() => {
  if (harness) {
    harness.cleanupScribe();
    harness = null;
  }
});
const entities = () => harness.createds.Entity;

const bTestRootId = "@$~raw.b_test_chronicle@@";

describe("Chronicle freezing", () => {
  const transactionA = Object.freeze({
    type: "TRANSACTED",
    actions: [
      created({ id: vCrossRef("test_entity", testRootId), typeName: "Entity", initialState: {
        name: "Test Entity",
        owner: vRef(testRootId, "unnamedOwnlings"),
      }, }),
      created({ id: vCrossRef("test_entity.prop", testRootId), typeName: "Property",
        initialState: {
          name: "prop",
          owner: vRef("test_entity", "properties"),
          value: { typeName: "Literal", value: "This is some string", },
        },
      }),
    ]
  });

  const lateEntityEvent = created({
    id: vCrossRef("late_entity", testRootId), typeName: "Entity", initialState: {
      name: "Late Entity",
      owner: vRef(testRootId, "unnamedOwnlings"),
    },
  });

  const freezeEventFor = (entityRawId: string) => transacted({
    actions: [fieldsSet({ id: vRef(entityRawId), typeName: "Entity", sets: { isFrozen: true } })],
  });

  it("allows freezing a chronicle", async () => {
    harness = await createEngineOracleHarness({ claimBaseBlock: false }, [transactionA]);
    expect(entities()[testRootId].step("isFrozen")).toBeFalsy();
    await harness.chronicleEvent(freezeEventFor(testRootId)).getPremiereStory();
    expect(entities()[testRootId].step("isFrozen")).toBeTruthy();
    expect(harness.testConnection.isFrozenConnection()).toBeTruthy();
  });

  it("prevents adding contents to a frozen chronicle", async () => {
    harness = await createEngineOracleHarness({ claimBaseBlock: false }, [transactionA]);
    await harness.chronicleEvent(freezeEventFor(testRootId)).getPremiereStory();
    expect(() => harness.chronicleEvent(lateEntityEvent))
        .toThrow(/Cannot modify frozen.*@\$~raw.test_chronicle@@/);
    expect(entities().late_entity).toBeFalsy();
  });

  it("prevents modifying properties of a frozen Entity", async () => {
    harness = await createEngineOracleHarness({ claimBaseBlock: false }, [transactionA]);
    await harness.chronicleEvent(freezeEventFor("test_entity")).getPremiereStory();
    expect(() => entities().test_entity.assignProperty("prop", "Changed string"))
        .toThrow(/Cannot modify frozen.*test_entity/);
    expect(entities().test_entity.propertyValue("prop"))
        .toEqual("This is some string");
  });

  it("allows modifying the owner of a frozen Entity", async () => {
    harness = await createEngineOracleHarness({ claimBaseBlock: false, verbosity: 0 },
        [transactionA, lateEntityEvent]);
    await harness.chronicleEvent(freezeEventFor("test_entity")).getPremiereStory();
    expect(() => entities().test_entity.setField("owner", entities().late_entity))
        .not.toThrow();
    expect(entities().test_entity.step("owner").getVRef())
        .toEqual(entities().late_entity.getVRef());
    expect(() => entities().test_entity.assignProperty("prop", "Changed string"))
        .toThrow(/Cannot modify frozen.*test_entity/);
  });

  const transactionB = {
    type: "TRANSACTED",
    actions: [
      created({ id: vCrossRef(bTestRootId, bTestRootId), typeName: "Entity",
        initialState: {
          name: "Test Chronicle B",
          authorityURI: "valaa-test:",
        }, }),
      created({ id: vCrossRef("test_entity_b", bTestRootId), typeName: "Entity",
        initialState: {
          name: "Test Entity B",
          owner: vRef(bTestRootId, "unnamedOwnlings"),
        },
      }),
      created({ id: vCrossRef("test_entity_b.prop_b", bTestRootId), typeName: "Property",
        initialState: {
          name: "prop_b",
          owner: vRef("test_entity_b", "properties"),
          value: { typeName: "Literal", value: "This is some string", },
        },
      }),
    ]
  };

  const lateEntityEventB = created({
    id: vCrossRef("late_entity_b", bTestRootId), typeName: "Entity", initialState: {
      name: "Another Late Entity",
      owner: vRef(bTestRootId, "unnamedOwnlings"),
    },
  });

  it("doesn't prevent the user from editing non-frozen chronicles", async () => {
    harness = await createEngineOracleHarness({
      verbosity: 0, claimBaseBlock: false, acquireConnections: [bTestRootId],
    }, [transactionA, transactionB]);
    await harness.chronicleEvent(freezeEventFor(testRootId)).getPremiereStory();
    expect(() => harness.chronicleEvent(lateEntityEvent))
        .toThrow(/Cannot modify frozen.*@\$~raw.test_chronicle@@/);
    expect(entities().late_entity).toBeFalsy();
    await harness.chronicleEvent(lateEntityEventB).getPremiereStory();
    expect(entities().late_entity_b).toBeTruthy();
  });
});
