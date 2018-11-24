import { OrderedMap } from "immutable";
import { created, fieldsSet, removedFrom, destroyed } from "~/raem/events";
import VALK from "~/raem/VALK";

import { vRef } from "~/raem/ValaaReference";

import getObjectTransient from "~/raem/state/getObjectTransient";
import getObjectField from "~/raem/state/getObjectField";
import GhostPath from "~/raem/state/GhostPath";

import { createRAEMTestHarness } from "~/raem/test/RAEMTestHarness";
import { isMaterialized, createMaterializeGhostAction }
    from "~/raem/tools/denormalized/ghost";

import invariantify from "~/tools/invariantify";

// This file uses structured snake_case variable names to denote ownership hierarchies
/* eslint-disable camelcase */

describe("The snapshot node walker", () => {
  const createBlockA = [
    created({ id: "A_grandparent", typeName: "TestThing" }),
    created({ id: "A_parent", typeName: "TestThing",
      initialState: { owner: vRef("A_grandparent", "children") },
    }),
    created({ id: "A_child1", typeName: "TestThing",
      initialState: { owner: vRef("A_parent", "children") },
    }),
  ];

  const createBlockARest = [
    created({ id: "A_child2", typeName: "TestThing",
      initialState: { owner: vRef("A_parent", "children") },
    }),
    created({ id: "A_childGlue", typeName: "TestGlue", initialState: {
      source: "A_child1", target: "A_child2", position: { x: 0, y: 1, z: null },
    } }),
    created({ id: "A_childDataGlue", typeName: "TestDataGlue", initialState: {
      source: "A_child1", target: "A_child2",
    } }),
    fieldsSet({ id: "A_child1", typeName: "TestThing",
      sets: { targetDataGlues: ["A_childDataGlue"], },
    }),
    fieldsSet({ id: "A_child2", typeName: "TestThing",
      sets: { sourceDataGlues: ["A_childDataGlue"], },
    }),
  ];

  it("retrieves aliased value properly", async () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createBlockA, createBlockARest);
    const childGlue = getObjectTransient(harness.getState(), "A_childGlue", "TestGlue");
    expect(childGlue.get("source"))
        .toEqual(undefined);
    expect(getObjectField(harness.corpus, childGlue, "source"))
        .toEqual(vRef("A_child1", "targetGlues"));
    expect(harness.run(vRef("A_childGlue"), "source"))
        .toEqual(vRef("A_child1"));
  });

  it("retrieves expanded values properly", async () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createBlockA, createBlockARest);

    expect(harness.run(vRef("A_childGlue"), "position"))
        .toEqual(OrderedMap([["x", 0], ["y", 1], ["z", null]]));
  });

  const createBlockAMore = [
    created({ id: "A_child3", typeName: "TestThing",
      initialState: { owner: vRef("A_parent", "children") },
    }),
    created({ id: "A_childGlue13", typeName: "TestGlue", initialState: {
      source: "A_child1", target: "A_child3", name: "moveTo", position: { x: 30, y: 30, z: null },
    } }),
    created({ id: "A_childGlue12", typeName: "TestGlue", initialState: {
      source: "A_child1", target: "A_child2", name: "moveTo", position: { x: 20, y: 20, z: null },
    } }),
  ];

  it("executes a complex path + filtering kuery properly", async () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createBlockA, createBlockARest,
        createBlockAMore);
    const childGlue = getObjectTransient(harness.getState(), "A_childGlue", "TestGlue");
    const child2 = getObjectTransient(harness.getState(), "A_child2", "TestThing");
    expect(harness.run(childGlue, VALK.to("source").to("targetGlues")
        .find(VALK.to("name").equalTo("moveTo").and(
            VALK.to("target").equalTo(child2.get("id"))))))
        .toEqual(vRef("A_childGlue12"));
  });
});

describe("ghost lookups", () => {
  const createTestObj = [
    created({ id: "testObj", typeName: "TestThing", initialState: { name: "testObj" } }),
    created({ id: "ownling", typeName: "TestThing", initialState: {
      parent: "testObj", name: "ownling"
    }, }),
    created({ id: "grandling", typeName: "TestThing", initialState: {
      parent: "ownling",
    }, }),
    created({ id: "greatGrandling", typeName: "TestThing", initialState: {
      parent: "grandling",
    }, }),
  ];

  const createTestObjInst = [
    created({ id: "testObjInst", typeName: "TestThing",
      initialState: { instancePrototype: "testObj" },
    }),
  ];

  const createOwnlingInst = [
    created({ id: "ownlingInst", typeName: "TestThing",
      initialState: { instancePrototype: "ownling" },
    }),
  ];

  it("Resource-to-Immaterial-Transient - if an Instance Prototype has a field reference to its " +
     "Ownling, then Instance field access for the same field returns a Transient for the " +
     "Immaterial Ghost of the Ownling", () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createTestObj, createTestObjInst);
    const ghostOwnling = harness.run(vRef("testObjInst"),
        ["§->", "children", 0]);

    expect(isMaterialized(harness.getState(), ghostOwnling))
        .toEqual(false);
  });

  it("Resource-to-Material-Transient - same as above but if the Ghost has been Materialized before",
  () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createTestObj, createTestObjInst);
    let ghostOwnling = harness.run(vRef("testObjInst"),
        ["§->", "children", 0]);
    const materializeEvent = createMaterializeGhostAction(harness.getState(), ghostOwnling);
    harness.chronicleEvent(materializeEvent);
    ghostOwnling = harness.run(vRef("testObjInst"),
        ["§->", "children", 0]);

    expect(isMaterialized(harness.getState(), ghostOwnling))
        .toEqual(true);
    const transient = harness.getState().getIn(["TestThing", ghostOwnling.rawId()]);
    expect(transient.get("prototype"))
        .toBeDefined();
    expect(transient.get("prototype"))
        .toEqual(vRef("ownling", "materializedGhosts", new GhostPath("ownling")));
  });

  it("Resource-to-Partially-Material-Transient - same as above but when the Prototype Sequence is" +
     " deeper and some middle Ghost has been Materialized", () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createTestObj, createTestObjInst);
    let ghostOwnling = harness.run(vRef("testObjInst"),
        ["§->", "children", 0]);
    harness.chronicleEvent(createMaterializeGhostAction(harness.getState(), ghostOwnling));
    ghostOwnling = harness.run(vRef("testObjInst"),
        ["§->", "children", 0]);
    const ghostGrandling = harness.run(ghostOwnling, ["§->", "children", 0]);

    expect(isMaterialized(harness.getState(), ghostGrandling))
        .toEqual(false);
  });

  // the transients can be used as the starting point for Kueries
  // with the exact same variety of results as when using a full Resource

  it("Immaterial-Transient-to-* - The ghost grandling should be immaterial", () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createTestObj, createOwnlingInst);
    const ghostGrandling = harness.run(vRef("ownlingInst"),
        ["§->", "children", 0]);

    expect(isMaterialized(harness.getState(), ghostGrandling))
        .toEqual(false);
  });

  it("Material-Transient-to-* - the ghost grandling should be materialized", () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createTestObj, createOwnlingInst);
    let ghostGrandling = harness.run(vRef("ownlingInst"),
        ["§->", "children", 0]);
    harness.chronicleEvent(createMaterializeGhostAction(harness.getState(), ghostGrandling));
    ghostGrandling = harness.run(vRef("ownlingInst"),
        ["§->", "children", 0]);

    expect(isMaterialized(harness.getState(), ghostGrandling))
        .toEqual(true);
    const transient = harness.getState().getIn(["TestThing", ghostGrandling.rawId()]);
    expect(transient.get("prototype"))
        .toBeDefined();
    expect(transient.get("prototype"))
        .toEqual(vRef("grandling", "materializedGhosts", new GhostPath("grandling")));
  });

  it("Partially-Material-Transient-to-* - the ghost great grandling should be immaterial", () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createTestObj, createOwnlingInst);
    let ghostGrandling = harness.run(vRef("ownlingInst"),
        ["§->", "children", 0]);
    harness.chronicleEvent(createMaterializeGhostAction(harness.getState(), ghostGrandling));
    ghostGrandling = harness.run(vRef("ownlingInst"),
        ["§->", "children", 0]);
    const ghostGreatGrandling = harness.run(ghostGrandling, ["§->", "children", 0]);

    expect(isMaterialized(harness.getState(), ghostGreatGrandling))
        .toEqual(false);
  });

  it("omits the prototype fields through Resource.ownFields", () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createTestObj, createOwnlingInst);
    expect(harness.run(vRef("ownlingInst"), "name"))
        .toEqual("ownling");
    expect(harness.run(vRef("ownlingInst"), VALK.toField("ownFields").toField("name")))
        .toEqual(undefined);
    expect(harness.run(vRef("ownlingInst"), "children").length)
        .toEqual(1);
    expect(harness.run(vRef("ownlingInst"), VALK.toField("ownFields").toField("children")))
        .toEqual(undefined);
  });
});

describe("mutations", () => {
  const createData = [
    created({ id: "A", typeName: "TestThing", initialState: {
      name: "Original",
    } }),
    created({ id: "A_B", typeName: "TestThing", initialState: {
      parent: "A", name: "Ownling",
    } }),
  ];

  const createInstance = [
    created({ id: "A_instance", typeName: "TestThing", initialState: {
      instancePrototype: "A", name: "Instance of Original",
    } }),
  ];

  const createBlankInstance = [
    created({ id: "A_instance_blank", typeName: "TestThing",
      initialState: { instancePrototype: "A", } }),
  ];

  it("FIELDS_SET setting a field on a Transient should materialize it", () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createData, createInstance);
    const A_instance = harness.run(vRef("A_instance"), null);
    let A_instance_B = harness.run(A_instance, ["§->", "children", 0]);
    expect(isMaterialized(harness.getState(), A_instance_B))
        .toEqual(false);
    harness.chronicleEvent(fieldsSet({ id: A_instance_B, typeName: "TestThing",
      sets: { name: "sanic", },
    }));
    A_instance_B = harness.run(A_instance, ["§->", "children", 0]);
    expect(isMaterialized(harness.getState(), A_instance_B))
        .toEqual(true);
  });

  it("FIELDS_SET assigning a Transient to a non-coupling field does not materialize it", () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createData, createInstance);
    const A = harness.run(vRef("A"), null);
    const A_instance = harness.run(vRef("A_instance"), null);
    let A_instance_B = harness.run(A_instance, ["§->", "children", 0]);
    expect(isMaterialized(harness.getState(), A_instance_B))
        .toEqual(false);
    harness.chronicleEvent(fieldsSet({ id: A, typeName: "TestThing",
      sets: { uncoupledField: A_instance_B },
    }));
    A_instance_B = harness.run(A_instance, ["§->", "children", 0]);
    expect(isMaterialized(harness.getState(), A_instance_B))
        .toEqual(false);
  });

  it("REMOVED_FROM.removes(null) on a previously modified field on a non-ghost Instance reveals " +
     "the undeflying Prototype field", () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createData, createInstance);

    const A = harness.run(vRef("A"), null);
    const A_instance = harness.run(vRef("A_instance"), null);

    // Do tests that do not depend on autorefresh
    const A_name = harness.run(vRef("A"), "name");
    const A_instance_name = harness.run(A_instance, "name");
    harness.chronicleEvent(removedFrom({ id: "A_instance", typeName: "TestThing",
      removes: { name: null } }));
    const A_instance_name_after_erase = harness.run(vRef("A_instance"),
        "name");
    expect(A_instance_name)
        .not.toEqual(A_name);
    expect(A_instance_name_after_erase)
        .not.toEqual(A_instance_name);
    expect(A_instance_name_after_erase)
        .toEqual(A_name);

    // Do test that depends on autorefresh
    expect(harness.run(A_instance, "name"))
        .toEqual(harness.run(A, "name"));
  });

  it("FIELDS_SET.removes(null) on a previously modified field on an Ghost reveals " +
     "the undeflying Prototype field", () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createData, createInstance);

    const A_B = harness.run(vRef("A_B"), null);
    const A_instance_B = harness.run(vRef("A_instance"),
        ["§->", "children", 0]);

    // Names are equal before any modifications to the ghost and different after changes
    expect(harness.run(A_instance_B, "name", { verbosity: 0 }))
        .toEqual(harness.run(A_B, "name"));
    harness.chronicleEvent(fieldsSet({ id: A_instance_B, typeName: "TestThing",
      sets: { name: "Ghost of Ownling" }
    }));
    expect(harness.run(A_instance_B, "name"))
        .not.toEqual(harness.run(A_B, "name"));

    // Set value back to undefined, restoring the value to the prototype's current value
    harness.chronicleEvent(removedFrom({ id: A_instance_B, typeName: "TestThing",
      removes: { name: null }
    }));
    expect(harness.run(A_instance_B, "name"))
        .toEqual(harness.run(A_B, "name"));
  });

  it("CREATED add on an plural owner field causes changes to be reflected on Instances", () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createData, createInstance);

    const A_children_old = harness.run(vRef("A"), ["§->", "children"]);
    const A_instance_children_old = harness.run(vRef("A_instance"),
        ["§->", "children"]);

    // Ensure the two lists are equal at the start
    expect(A_instance_children_old.length)
        .toEqual(A_children_old.length);
    for (let c = 0; c < A_children_old.length; c++) {
      expect(`${c}: ${harness.run(A_instance_children_old[c], "name")}`)
          .toEqual(`${c}: ${harness.run(A_children_old[c], "name")}`);
    }

    // Modify the original list
    const A = harness.run(vRef("A"), null);
    harness.chronicleEvent(created({ id: "A_C", typeName: "TestThing",
      initialState: { parent: A, name: "Second Ownling" } }));
    harness.chronicleEvent(created({ id: "A_D", typeName: "TestThing",
      initialState: { parent: A, name: "Third Ownling" } }));

    // Ensure that the new lists are different to the old ones, but equal to each other
    const A_children_new = harness.run(vRef("A"), ["§->", "children"]);
    const A_instance_children_new = harness.run(vRef("A_instance"),
        ["§->", "children"]);
    expect(A_children_new.length)
        .not.toEqual(A_children_old.length);
    expect(A_instance_children_new.length)
        .not.toEqual(A_children_old.length);

    expect(A_instance_children_new.length)
        .toEqual(A_children_new.length);
    for (let c = 0; c < A_children_new.length; c++) {
      expect(`${c}: ${harness.run(A_instance_children_new[c], "name")}`)
          .toEqual(`${c}: ${harness.run(A_children_new[c], "name")}`);
    }
  });

  const extraData = [
    created({ id: "A_C", typeName: "TestThing",
      initialState: { parent: "A", name: "Memelord" } }),
    created({ id: "A_D", typeName: "TestThing",
      initialState: { parent: "A", name: "Kenny" } }),
  ];

  it("DESTROYED remove on a plural owner field causes changes to be reflected on Instances", () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createData, extraData,
        createInstance);

    const A_children_old = harness.run(vRef("A"), ["§->", "children"]);
    const A_instance_children_old = harness.run(vRef("A_instance"),
        ["§->", "children"]);

    // Ensure that the two lists are equal at the start
    expect(A_children_old.length)
        .toEqual(A_instance_children_old.length);
    for (let c = 0; c < A_children_old.length; c++) {
      expect(harness.run(A_children_old[c], "name"))
          .toEqual(harness.run(A_instance_children_old[c], "name"));
    }

    // Modify the original list
    harness.chronicleEvent(destroyed({ id: "A_C" }));
    harness.chronicleEvent(destroyed({ id: "A_D" }));

    // Ensure that the new lists are different to the old ones, but equal to each other
    const A_children_new = harness.run(vRef("A"), ["§->", "children"]);
    const A_instance_children_new = harness.run(vRef("A_instance"),
        ["§->", "children"]);

    expect(A_children_new.length)
        .not.toEqual(A_children_old.length);
    expect(A_instance_children_new.length)
        .not.toEqual();

    expect(A_instance_children_new.length)
        .toEqual(A_children_new.length);
    for (let c = 0; c < A_children_new.length; c++) {
      expect(harness.run(A_instance_children_new[c], "name"))
          .toEqual(harness.run(A_children_new[c], "name"));
    }
  });

  it("FIELDS_SET commands on a Prototype should reflect as new field values on all Instances and" +
      "their ghosts as appropriate", () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createData, createBlankInstance);

    // Test instance
    harness.chronicleEvent(fieldsSet({ id: "A", typeName: "TestThing",
      sets: { name: "What is dead may never die and in strange aeons even death may die", },
    }));
    expect(
      harness.run(vRef("A_instance_blank"), ["§->", "name"])
    ).toEqual(
      harness.run(vRef("A"), ["§->", "name"])
    );

    // Test ghost
    harness.chronicleEvent(fieldsSet({ id: "A_B", typeName: "TestThing",
      sets: { name: "cthulhu fhtagn", },
    }));
    // A_B is child of A, so query children -> 0 -> name
    expect(
      harness.run(vRef("A_instance_blank"), ["§->", "children", 0, "name"])
    ).toEqual(
      harness.run(vRef("A"), ["§->", "children", 0, "name"])
    );
  });
});

describe("complex structures", () => {
  const names = {
    A: "Elder",
    A_B: "Elder / Middle",
    A_B_C: "Elder / Middle / Youngest",
    T: "ElderTwo",
  };
  const baseData = [
    created({ id: "A", typeName: "TestThing", initialState: {
      name: names.A,
    } }),
    created({ id: "A_B", typeName: "TestThing", initialState: {
      parent: "A", name: names.A_B,
    } }),
    created({ id: "A_B_C", typeName: "TestThing", initialState: {
      parent: "A_B", name: names.A_B_C,
    } }),
    created({ id: "T", typeName: "TestThing", initialState: {
      name: names.T,
    } }),
  ];
  const firstDegreeInstances = [
    created({ id: "A1i", typeName: "TestThing", initialState: {
      instancePrototype: "A"
    } }),
    created({ id: "A_B1i", typeName: "TestThing", initialState: {
      instancePrototype: "A_B", parent: "A",
    } }),
    created({ id: "A_B_C1i", typeName: "TestThing", initialState: {
      instancePrototype: "A_B_C", parent: "A_B",
    } }),
  ];
  const firstDegreeUpwardsInstances = [
    created({ id: "B2i", typeName: "TestThing", initialState: {
      instancePrototype: "A_B",
    } }),
    created({ id: "A_C2i", typeName: "TestThing", initialState: {
      instancePrototype: "A_B_C", parent: "A",
    } }),
    created({ id: "C3", typeName: "TestThing", initialState: {
      instancePrototype: "A_B_C",
    } }),
  ];
  const firstDegreeDownwardsInstances = [
    created({ id: "A_B_C_T1i", typeName: "TestThing", initialState: {
      instancePrototype: "T", parent: "A_B_C",
    } }),
    created({ id: "A_B_T2i", typeName: "TestThing", initialState: {
      instancePrototype: "T", parent: "A_B",
    } }),
    created({ id: "A_T3i", typeName: "TestThing", initialState: {
      instancePrototype: "T", parent: "A",
    } }),
  ];

  /*
  const createSecondDegreeInstances = (harness) => {
    const gA1_B = harness.run(vRef("A1i"),
        ["§->", "children", 0], { verbosity: 0 });
    const gA1_B_C = harness.run(vRef("A1i"),
        ["§->", "children", 0, "children", 0], { verbosity: 0 });
    const gA_B1_C = harness.run(vRef("A_B1i"),
        ["§->", "children", 0], { verbosity: 0 });

    // Falling apart workaround
    harness.chronicleEvent(createMaterializeGhostAction(harness.getState(), gA1_B));
    harness.chronicleEvent(createMaterializeGhostAction(harness.getState(), gA1_B_C));
    harness.chronicleEvent(createMaterializeGhostAction(harness.getState(), gA_B1_C));

    // Here everything falls apart
    harness.chronicleEvent(created({ id: "gA1_B1", typeName: "TestThing", initialState: {
      instancePrototype: gA1_B,
    } }));
    harness.chronicleEvent(created({ id: "gA1_B_C1", typeName: "TestThing", initialState: {
      instancePrototype: gA1_B_C,
    } }));
    harness.chronicleEvent(created({ id: "gA_B1_C1", typeName: "TestThing", initialState: {
      instancePrototype: gA_B1_C,
    } }));
  };
  */

  /*
  const createThirdDegreeInstances = (harness) => {
      const gA1_B1_C = harness.run(vRef("gA1_B1"), ["§->", "children", 0]);
      harness.chronicleEvent(created({ id: "gA1_B1_C1", typeName: "TestThing", initialState: {
        instancePrototype: gA1_B1_C,
      } }));
  };
  */

  let harness;
  let infoLookup;
  let allInfos;

  function getInfo (name) {
    const ret = infoLookup[name];
    invariantify(ret, `object '${name}' info missing or unitialized`);
    return ret;
  }

  // The indentations here denote ownership hierarchy: also expressed with underscores.
  // Name starting with 'i' denotes that the object is a full instance: this is always preceded by
  // the instantiation order index.
  // Name ending with 'g' denotes that the object is a ghost instance.
  // By default an instance component is expected to contain a bunch of ghost instances but is not
  // limited to this. Explicit creations and instantiations can be added to instances naturally.
  // Other components are regularily created infos.
  /* eslint-disable indent */
  /* eslint-disable no-unused-vars */
  let // eslint-disable-line one-var
    T,
    A,
      A_B,
        A_B_C,
          A_B_C_T1i,
        A_B_C1i,
          gA_B_C1_T1,
        A_B_T2i,
      A_B1i,
        gA_B1_C,
          gA_B1_C_T1,
        gA_B1_C1,
          gA_B1_C1_T1,
        gA_B1_T2,
      A_C2i,
        gA_C2_T1,
      A_T3i,
    A1i,
      gA1_B,
        gA1_B_C,
          gA1_B_C_T1,
        gA1_B_C1,
          gA1_B_C1_T1,
        gA1_B_T2,
      gA1_B1,
        gA1_B1_C,
          gA1_B1_C_T1,
        gA1_B1_C1,
          gA1_B1_C1_T1,
        gA1_B1_T2,
      gA1_C2,
        gA1_C2_T1,
      gA1_T3,
    B2i,
      gB2_C,
        gB2_C_T1,
      gB2_C1,
        gB2_C1_T1,
      gB2_T2,
    C3,
      gC3_T1;
  /* eslint-enable no-unused-vars */
  /* eslint-enable indent */

  function createAndExtractHarnessWithCommands (options, ...commandLists) {
    harness = createRAEMTestHarness(options, baseData,
        firstDegreeInstances, firstDegreeUpwardsInstances, firstDegreeDownwardsInstances,
        ...commandLists);
    // createSecondDegreeInstances(harness);
    // createThirdDegreeInstances(harness);

    infoLookup = {};
    allInfos = [];
    function extractInfoAndGetTransient (name: string, parent: any = null,
        prototypeName: string = null) {
      const info = infoLookup[name] = {
        name,
        transient: harness.run(
          (parent && getInfo(parent[0]).transient) || vRef(name),
          (parent && parent.slice(1).map(index => ["§->", "children", index])) || null,
          { verbosity: 0 },
        ),
        parent: parent && getInfo(parent[0]),
        ancestors: (function collectAncestors (list, parent_) {
          if (parent_) { collectAncestors(list, parent_.parent); list.push(parent_); }
          return list;
        }([], parent && getInfo(parent[0]))),
        children: [],
        descendants: [],
        prototype: prototypeName && getInfo(prototypeName),
        prototypes: (function collectPrototypes (list, prototype_) {
          if (prototype_) { collectPrototypes(list, prototype_.prototype); list.push(prototype_); }
          return list;
        }([], prototypeName && getInfo(prototypeName))),
        directInstances: [],
        instances: [],
      };
      allInfos.push(info);
      if (info.parent) info.parent.children.push(info);
      info.ancestors.forEach(ancestor => { ancestor.descendants.push(info); });
      if (info.prototype) info.prototype.directInstances.push(info);
      info.prototypes.forEach(prototype_ => { prototype_.instances.push(info); });
      return info.transient;
    }

    // There is a method to this madness.
    // 'The line object' means the object which is extracted on a specific line below.
    // 'The line info' means the info lookup structure which is created byextractInfoAndGetTransient
    // The first extraction parameter is the test lookup name of the line object and line info.
    // The second parameter of the extraction is [ownerName, child index]: the owner of the line
    // object  is always the most recent previous line object with indent two spaces less.
    // The child index is the number of siblings ie. lines with equal indent that are between the
    // line itself and its owner line.
    // The third parameter is the prototype of the line. It can be found as follows:
    // 1. If the line is an instantiation line ie. ends with 'i' the instance prototype name is
    //    determined by the created event instancePrototype corresponding to the line object.
    // 2. Otherwise the line is a ghost, and the prototype is a ghost instance.
    //    Let's use the ghost gA1_B_C1_T1 as example.
    // 3. Find the ghost host of the ghost. This is the innermost ancestor owner (line with biggest
    //    line number) of the ghost line which has name ending with 'i': this is the instantiated
    //    object that is responsible for bringing the line ghost object into being.
    //    Ghost host of gA1_B_C1_T1 is A1i.
    // 4. Find the ghost host prototype of the ghost host. Get prototype name of the ghost host
    //    from the third parameter, and find the line which extracts this object.
    //    Ghost host prototype of A1i is A.
    // 5. Count the number of g-prefixed lines from the ghost (inclusive) to its ghost host.
    //    The prototype of the ghost can be found by counting equal number of lines down from ghost
    //    host prototype.
    //    The number of g-lines from A1i to gA1_B_C1_T1 is 5. 5 lines down from A is gA_B_C1_T1,
    //    which thus is the prototype and thus also the third extraction parameter for gA1_B_C1_T1.
    // Note that the order of these extractions must be explicitly maintained to correspond to the
    // actual object creation commands. Specifically, the requirements are:
    // 1. the order of sibling extraction lines (lines with same parent) must match that of the
    //    "children" transient property of the parent after all init commands have been resolved.
    // 2. similarily the order of instantiation lines must match the "instances" transient property
    //    of their instance prototype object.
    /* eslint-disable indent */
    T = extractInfoAndGetTransient("T");
    A = extractInfoAndGetTransient("A");
      A_B = extractInfoAndGetTransient("A_B", ["A", 0]);
        A_B_C = extractInfoAndGetTransient("A_B_C", ["A_B", 0]);
          A_B_C_T1i = extractInfoAndGetTransient("A_B_C_T1i", ["A_B_C", 0], "T");
        A_B_C1i = extractInfoAndGetTransient("A_B_C1i", ["A_B", 1], "A_B_C");
          gA_B_C1_T1 = extractInfoAndGetTransient("gA_B_C1_T1", ["A_B_C1i", 0], "A_B_C_T1i");
        A_B_T2i = extractInfoAndGetTransient("A_B_T2i", ["A_B", 2], "T");
      A_B1i = extractInfoAndGetTransient("A_B1i", ["A", 1], "A_B");
        gA_B1_C = extractInfoAndGetTransient("gA_B1_C", ["A_B1i", 0], "A_B_C");
          gA_B1_C_T1 = extractInfoAndGetTransient("gA_B1_C_T1", ["gA_B1_C", 0], "A_B_C_T1i");
        gA_B1_C1 = extractInfoAndGetTransient("gA_B1_C1", ["A_B1i", 1], "A_B_C1i");
          gA_B1_C1_T1 = extractInfoAndGetTransient("gA_B1_C1_T1", ["gA_B1_C1", 0], "gA_B_C1_T1");
        gA_B1_T2 = extractInfoAndGetTransient("gA_B1_T2", ["A_B1i", 2], "A_B_T2i");
      A_C2i = extractInfoAndGetTransient("A_C2i", ["A", 2], "A_B_C");
        gA_C2_T1 = extractInfoAndGetTransient("gA_C2_T1", ["A_C2i", 0], "A_B_C_T1i");
      A_T3i = extractInfoAndGetTransient("A_T3i", ["A", 3], "T");
    A1i = extractInfoAndGetTransient("A1i");
      gA1_B = extractInfoAndGetTransient("gA1_B", ["A1i", 0], "A_B");
        gA1_B_C = extractInfoAndGetTransient("gA1_B_C", ["gA1_B", 0], "A_B_C");
          gA1_B_C_T1 = extractInfoAndGetTransient("gA1_B_C_T1", ["gA1_B_C", 0], "A_B_C_T1i");
        gA1_B_C1 = extractInfoAndGetTransient("gA1_B_C1", ["gA1_B", 1], "A_B_C1i");
          gA1_B_C1_T1 = extractInfoAndGetTransient("gA1_B_C1_T1", ["gA1_B_C1", 0], "gA_B_C1_T1");
        gA1_B_T2 = extractInfoAndGetTransient("gA1_B_T2", ["gA1_B", 2], "A_B_T2i");
      gA1_B1 = extractInfoAndGetTransient("gA1_B1", ["A1i", 1], "A_B1i");
        gA1_B1_C = extractInfoAndGetTransient("gA1_B1_C", ["gA1_B1", 0], "gA_B1_C");
          gA1_B1_C_T1 = extractInfoAndGetTransient("gA1_B1_C_T1", ["gA1_B1_C", 0], "gA_B1_C_T1");
        gA1_B1_C1 = extractInfoAndGetTransient("gA1_B1_C1", ["gA1_B1", 1], "gA_B1_C1");
          gA1_B1_C1_T1 = extractInfoAndGetTransient("gA1_B1_C1_T1", ["gA1_B1_C1", 0],
              "gA_B1_C1_T1");
        gA1_B1_T2 = extractInfoAndGetTransient("gA1_B1_T2", ["gA1_B1", 2], "gA_B1_T2");
      gA1_C2 = extractInfoAndGetTransient("gA1_C2", ["A1i", 2], "A_C2i");
        gA1_C2_T1 = extractInfoAndGetTransient("gA1_C2_T1", ["gA1_C2", 0], "gA_C2_T1");
      gA1_T3 = extractInfoAndGetTransient("gA1_T3", ["A1i", 3], "A_T3i");
    B2i = extractInfoAndGetTransient("B2i");
      gB2_C = extractInfoAndGetTransient("gB2_C", ["B2i", 0], "");
        gB2_C_T1 = extractInfoAndGetTransient("gB2_C_T1", ["gB2_C", 0], "");
      gB2_C1 = extractInfoAndGetTransient("gB2_C1", ["B2i", 1], "");
        gB2_C1_T1 = extractInfoAndGetTransient("gB2_C1_T1", ["gB2_C1", 0], "");
      gB2_T2 = extractInfoAndGetTransient("gB2_T2", ["B2i", 2], "");
    C3 = extractInfoAndGetTransient("C3");
      gC3_T1 = extractInfoAndGetTransient("gC3_T1", ["C3", 0], "A_B_C_T1i");
    /* eslint-enable indent */
  }

  it("Ensure that all instances & ghosts have the same names with their root prototype", () => {
    createAndExtractHarnessWithCommands({ verbosity: 0 });
    allInfos.forEach(({ name, transient, prototypes }) => {
      if (prototypes.length) {
        expect(`${name}: ${harness.run(transient, "name")}`)
            .toEqual(`${name}: ${harness.run(prototypes[0].transient, "name")}`);
      }
    });
  });

  it("Modifications in A_B_C should be reflected in and only in *_*_C*", () => {
    createAndExtractHarnessWithCommands({ verbosity: 0 });
    const oldName = harness.run(A_B_C, "name");
    const newName = "Elder / Middle / Youngest (A_B_C modification)";
    harness.chronicleEvent(fieldsSet({ id: A_B_C, typeName: "TestThing",
      sets: { name: newName },
    }));
    expect(harness.run(A_B_C, "name")).not.toEqual(oldName);
    getInfo("A_B_C").instances.forEach(({ name: instanceName, transient }) => {
      expect(`/*C/: ${instanceName}: ${harness.run(transient, "name")}`)
          .toEqual(`/*C/: ${instanceName}: ${newName}`);
    });
    // Check that all instances of non-A_B_C roots have their root prototype's name.
    allInfos.forEach(({ name: objectName, instances, prototype }) => {
      if (prototype || objectName === "A_B_C") return;
      instances.forEach(({ name: instanceName, transient }) => {
        expect(`${objectName}/${instanceName}: ${harness.run(transient, "name")}`)
            .toEqual(`${objectName}/${instanceName}: ${names[objectName]}`);
      });
    });
  });

  it("Modifications in A_B_C1i should be reflected in and only in *_*_C1", () => {
    createAndExtractHarnessWithCommands({ verbosity: 0 });
    const oldName = harness.run(A_B_C1i, "name");
    const newName = "Elder / Middle / Youngest (A_B_C1i modification)";
    harness.chronicleEvent(fieldsSet({ id: A_B_C1i, typeName: "TestThing",
      sets: { name: newName },
    }));
    expect(harness.run(A_B_C1i, "name")).toEqual(newName);

    getInfo("A_B_C").instances.forEach(({ name: instanceName, transient, prototypes }) => {
      if (instanceName === "A_B_C1i"
          || prototypes.find(({ name: prototypeName }) => prototypeName === "A_B_C1i")) {
        // Has "A_B_C1i" in the prototype chain
        expect(`/*C1/: ${instanceName}: ${harness.run(transient, "name")}`)
            .toEqual(`/*C1/: ${instanceName}: ${newName}`);
      } else {
        // Doesn't have "A_B_C1i" in the prototype chain
        expect(`!/*C1/: ${instanceName}: ${harness.run(transient, "name")}`)
            .toEqual(`!/*C1/: ${instanceName}: ${oldName}`);
      }
    });
  });

  it("Modifications in ghost gA_B1_C should be reflected in *_B1_C only", () => {
    createAndExtractHarnessWithCommands({ verbosity: 0 });
    const oldName = harness.run(gA_B1_C, "name", { verbosity: 0 });
    const newName = "Elder / Middle / Youngest (gA_B1_C modification)";
    harness.chronicleEvent(fieldsSet({ id: gA_B1_C, typeName: "TestThing",
      sets: { name: newName },
    }));
    expect(harness.run(gA_B1_C, "name", { verbosity: 0 })).toEqual(newName);

    getInfo("A_B_C").instances.forEach(({ name: instanceName, transient, prototypes }) => {
      if (instanceName === "gA_B1_C"
          || prototypes.find(({ name: prototypeName }) => prototypeName === "gA_B1_C")) {
        expect(`/*B1_C/: ${instanceName}: ${harness.run(transient, "name", { verbosity: 0 })}`)
            .toEqual(`/*B1_C/: ${instanceName}: ${newName}`);
      } else {
        expect(`!/*B1_C*/: ${instanceName}: ${harness.run(transient, "name", { verbosity: 0 })}`)
            .toEqual(`!/*B1_C*/: ${instanceName}: ${oldName}`);
      }
    });
  });

  it("Modifications in A_B_C should be visible from A1i, and A_B1i via children access", () => {
    createAndExtractHarnessWithCommands({ verbosity: 0 });
    const oldName = harness.run(A_B_C, "name");
    harness.chronicleEvent(fieldsSet({ id: A_B_C, typeName: "TestThing", sets: {
      name: "Elder / Middle / Youngest (changed)",
    } }));
    expect(harness.run(A_B_C, "name")).not.toEqual(oldName);
    expect(harness.run(A_B_C, "name")).toEqual(harness.run(A_B1i, ["§->", "children", 0, "name"]));
    expect(harness.run(A_B_C, "name")).toEqual(harness.run(gA1_B1, ["§->", "children", 0, "name"]));
    expect(harness.run(A_B_C, "name"))
      .toEqual(harness.run(A1i, ["§->", "children", 0, "children", 0, "name"]));
  });

  it("Instances simple unmodified lists", () => {
    createAndExtractHarnessWithCommands({ verbosity: 0 });
    // Confirm that all the lists A*_B* are similar
    const startingList = harness.run(A_B, ["§->", "children"]);

    expect(harness.run(A_B1i, ["§->", "children", ["§map", "prototype"]]))
        .toEqual(startingList);
    expect(harness.run(gA1_B, ["§->", "children", ["§map", "prototype"]]))
        .toEqual(startingList);
    expect(harness.run(gA1_B1, ["§->", "children", ["§map", "prototype", "prototype"]]))
        .toEqual(startingList);
  });

  it("Reflects instance list insertion properly to the instance list values", () => {
    createAndExtractHarnessWithCommands({ verbosity: 0 });
    // Confirm that all the lists A*_B* are similar
    const startingList = harness.run(A_B, "children", { verbosity: 0 });

    // Add a bloke to A_B1i
    harness.chronicleEvent(created({ id: "A_B1_D", typeName: "TestThing", initialState: {
      parent: A_B1i, name: "new guy",
    } }));

    // Confirm that lists in A_B, gA1_B differ from A_B1i, gA1_B1, but A_B1i equals to gA1_B1
    expect(harness.run(A_B1i, ["§->", "children", ["§map", "prototype"]]).slice(0, -1))
        .toEqual(startingList);
    expect(harness.run(gA1_B, ["§->", "children", ["§map", "prototype"]]))
        .toEqual(startingList);
    expect(harness.run(gA1_B1, ["§->", "children", ["§map", "prototype", "prototype"]]).slice(0, -1))
        .toEqual(startingList);

    expect(harness.run(gA1_B1, ["§->", "children", ["§map", "prototype"]]))
        .toEqual(harness.run(A_B1i, "children"));

    // Modify the name of the newly-added object
    harness.chronicleEvent(fieldsSet({ id: "A_B1_D", typeName: "TestThing",
      sets: { name: "new guy 2.0", },
    }));

    // Confirm that lists in A_B, gA1_B still differ from A_B1i, gA1_B1, but A_B1i equals to gA1_B1
    expect(harness.run(A_B1i, ["§->", "children", ["§map", "prototype"]]).slice(0, -1))
        .toEqual(startingList);
    expect(harness.run(gA1_B, ["§->", "children", ["§map", "prototype"]]))
        .toEqual(startingList);
    expect(harness.run(gA1_B1, ["§->", "children", ["§map", "prototype", "prototype"]]).slice(0, -1))
        .toEqual(startingList);

    expect(harness.run(gA1_B1, ["§->", "children", ["§map", "prototype"]]))
        .toEqual(harness.run(A_B1i, "children"));
  });
});
