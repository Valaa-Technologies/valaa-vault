import { created, fieldsSet } from "~/raem/events";
import VALK from "~/raem/VALK";

import { createRAEMTestHarness } from "~/raem/test/RAEMTestHarness";
import { VRef, IdData, vRef } from "~/raem/ValaaReference";

import GhostPath from "~/raem/state/GhostPath";
import { createTransient } from "~/raem/state/Transient";

import { createMaterializeGhostAction, createImmaterializeGhostAction, isGhost, isMaterialized,
    createGhostVRefInInstance } from "~/raem/tools/denormalized/ghost";

function _ghostVRef (prototypeRef: VRef, hostRawId: IdData, hostPrototypeRawId: string): VRef {
  const ghostPath = prototypeRef.getGhostPath().withNewGhostStep(hostPrototypeRawId, hostRawId);
  return vRef(ghostPath.headRawId(), null, ghostPath);
}

const createBaseTestObjects = [
  created({ id: "root", typeName: "TestThing" }),
  created({ id: "ownling", typeName: "TestThing", initialState: {
    parent: "root",
    name: "Ownling",
  }, }),
  created({ id: "grandling", typeName: "TestThing", initialState: {
    parent: "ownling",
    name: "Harambe",
  }, }),
  created({ id: "greatGrandling", typeName: "TestThing", initialState: {
    parent: "grandling",
    name: "Harambaby",
  }, }),
];

const createRootInstance = [
  created({ id: "root#1", typeName: "TestThing", initialState: {
    instancePrototype: "root",
  } }),
];

// Events which are not autoloaded as part of default setUp
const createRootInstanceInstance = [
  created({ id: "root#1#1", typeName: "TestThing", initialState: {
    instancePrototype: "root#1",
  } }),
];

const createGrandlingInstance = [
  created({ id: "grandling#1", typeName: "TestThing", initialState: {
    parent: "ownling",
    instancePrototype: "grandling",
  } }),
];

const createGhostGrandlingInstance = [
  created({ id: "grandling@root#1_#1", typeName: "TestThing", initialState: {
    parent: _ghostVRef(vRef("ownling"), "root#1", "root"),
    instancePrototype: _ghostVRef(vRef("grandling"), "root#1", "root"),
  } }),
];

/*
const createGhostGhostGrandlingInstance = [
  created({ id: "grandling@root#1#1_#1", typeName: "TestThing", initialState: {
    parent: _ghostVRef(
        _ghostVRef(vRef("ownling"), "root#1", "root"), "root#1#1", "root#1"),
    instancePrototype: _ghostVRef(
        _ghostVRef(vRef("grandling"), "root#1", "root"), "root#1#1", "root#1")
  } }),
];
*/

let harness;
function setUp ({ verbosity, commands = [] }: any) {
  harness = createRAEMTestHarness(
      { verbosity }, createBaseTestObjects, createRootInstance, commands);
}

function getTestPartition (id) { return harness.getState().getIn(["TestThing", id]); }

const getGhostOwnling = () => harness.run(
    vRef("root#1"), ["§->", "children", 0]);

const getGhostGrandling = () => harness.run(
    vRef("root#1"), ["§->", "children", 0, "children", 0]);
/*
const getGhostGhostOwnling = () => harness.run(
    vRef("root#1#1"), ["§->", "children", 0]);

const getGhostGhostGrandling = () => harness.run(
    vRef("root#1#1"), ["§->", "children", 0, "children", 0]);
*/
const getGrandlingInstance = () => harness.run(
    vRef("root"), ["§->", "children", 0, "children", 1]);
const getGrandlingInstanceGhost = () => harness.run(
    vRef("root#1"), ["§->", "children", 0, "children", 1]);
const getGrandlingInstanceGhostGhost = () => harness.run(
    vRef("root#1#1"), ["§->", "children", 0, "children", 1]);

describe("Ghost helpers", () => {
  it("Trivial GhostPath should get stringified", () => {
    setUp({ verbosity: 0 });
    const p = new GhostPath("flerp");
    expect(`${p}`).toEqual(`path('flerp')`);
  });

  it("Complex GhostPath should get stringified", () => {
    setUp({ verbosity: 0 });
    const p = new GhostPath("flerpProto").withNewStep("protoId", "instanceId", "flerpGhost");
    expect(`${p}`).toEqual(`path('flerpGhost'-@('instanceId'=|>'protoId')-|>'flerpProto')`);
  });

  it("isGhost should tell if an object has ghost path in its 'id'", () => {
    setUp({ verbosity: 0 });
    const notAGhost = createTransient();
    expect(isGhost(notAGhost))
        .toEqual(false);
    const isAGhost = createTransient({
      id: vRef("flerpGhost", null,
        (new GhostPath("flerp")).withNewStep("protoId", "instanceId", "flerpGhost")),
    });
    expect(isGhost(isAGhost))
        .toEqual(true);
    const isNotAGhostButAnInstance = createTransient({
      id: vRef("instanceId", null,
        (new GhostPath("flerp")).withNewStep("protoId", "instanceId", "instanceId")),
    });
    expect(isGhost(isNotAGhostButAnInstance))
        .toEqual(false);
  });

  it("immaterializeGhostActionDetail should bail if there is no materialized ghost to" +
     " immaterialize", () => {
    setUp({ verbosity: 0 });
    const mockGhost = createTransient({ id: vRef("notHere"), typeName: "notHere" });
    expect(
      createImmaterializeGhostAction(harness.getState(), mockGhost.get("id"))
    ).toBeUndefined();
  });
});

describe("Ghost materialization and immaterialization", () => {
  const assertMaterialized = ghostId => {
    expect(isMaterialized(harness.getState(), ghostId))
        .toEqual(true);
    expect(harness.run(ghostId, VALK.isImmaterial()))
        .toEqual(false);
    expect(harness.run(ghostId, VALK.isGhost()))
        .toEqual(true);
  };

  const assertImmaterialized = ghostId => {
    expect(isMaterialized(harness.getState(), ghostId))
        .toEqual(false);
    expect(harness.run(ghostId, VALK.isImmaterial()))
        .toEqual(true);
    expect(harness.run(ghostId, VALK.isGhost()))
        .toEqual(true);
  };

  it("Materialization should fail if the ghostPath is inactive", () => {
    setUp({ verbosity: 0 });
    const fakeGhost = createTransient({ id: vRef("dummyId"), typeName: "nope" });
    expect(() => {
      createMaterializeGhostAction(harness.getState(), fakeGhost.get("id"));
    }).toThrow(/ghostObjectPath.isGhost/);
  });

  it("Materialization should not materialize the owner", () => {
    setUp({ verbosity: 0, commands: createGrandlingInstance });
    assertImmaterialized(getGhostOwnling());
    const grandlingInRoot1 = _ghostVRef(vRef("grandling#1"), "root#1", "root");
    assertImmaterialized(grandlingInRoot1);
    harness.chronicleEvent(createMaterializeGhostAction(harness.getState(),
        getGrandlingInstanceGhost()));
    assertMaterialized(grandlingInRoot1);
    assertImmaterialized(getGhostOwnling());
  });

  it("should materialize a trivial ghost prototype of a ghost which is being materialized", () => {
    setUp({ verbosity: 0, commands: [...createGrandlingInstance, ...createRootInstanceInstance] });
    const grandlingInRoot1 = _ghostVRef(vRef("grandling#1"), "root#1", "root");
    const grandlingInRoot11 = _ghostVRef(grandlingInRoot1, "root#1#1", "root#1");
    harness.chronicleEvent(createMaterializeGhostAction(harness.getState(), grandlingInRoot11));
    assertMaterialized(grandlingInRoot11);
    assertMaterialized(grandlingInRoot1);
  });

  it("should materialize all ghost prototypes of a ghost which is being materialized", () => {
    setUp({
      verbosity: 0, commands: [...createGhostGrandlingInstance, ...createRootInstanceInstance],
    });
    const ghostGrandlingChild = harness.run(getGhostGrandling(), ["§->", "children", 0]);
    assertImmaterialized(ghostGrandlingChild);
    const ghostGrandlingInRoot11 = _ghostVRef(getGhostGrandling(), "root#1#1", "root#1");
    assertImmaterialized(ghostGrandlingInRoot11);
    const ghostGrandlingInRoot11Child =
        harness.run(ghostGrandlingInRoot11, ["§->", "children", 0]);
    assertImmaterialized(ghostGrandlingInRoot11Child);

    harness.chronicleEvent(
        createMaterializeGhostAction(harness.getState(), ghostGrandlingInRoot11Child));
    assertMaterialized(ghostGrandlingInRoot11Child);

    assertImmaterialized(ghostGrandlingInRoot11);
    assertMaterialized(ghostGrandlingChild);
  });

  it("Immaterialization should not immaterialize ownlings", () => {
    setUp({ verbosity: 0, commands: [] });
    assertImmaterialized(getGhostGrandling());
    harness.chronicleEvent(createMaterializeGhostAction(harness.getState(), getGhostGrandling()));
    assertMaterialized(getGhostGrandling());
    assertImmaterialized(getGhostOwnling());
    harness.chronicleEvent(createMaterializeGhostAction(harness.getState(), getGhostOwnling()));
    assertMaterialized(getGhostOwnling());

    harness.chronicleEvent(createImmaterializeGhostAction(harness.getState(), getGhostOwnling()));

    assertImmaterialized(getGhostOwnling());
    assertMaterialized(getGhostGrandling());
  });

  it("materializes a ghost of a ghost when its mutated", () => {
    setUp({ verbosity: 0, commands: createGrandlingInstance });
    const greatGrandling1 = harness.run(getTestPartition("grandling#1"), VALK.to("children").to(0));
    const greatGrandling1InRoot1VRef =
        createGhostVRefInInstance(greatGrandling1, getTestPartition("root#1"));
    const grandlingInRoot1VRef =
        createGhostVRefInInstance(vRef("grandling#1"), getTestPartition("root#1"));
    expect(getTestPartition(greatGrandling1InRoot1VRef.rawId()))
        .toBeFalsy();
    expect(harness.run(greatGrandling1InRoot1VRef, "name"))
        .toEqual("Harambaby");
    harness.chronicleEvent(fieldsSet({ id: greatGrandling1InRoot1VRef, typeName: "TestThing",
      sets: { name: "ghostGhostBaby" },
    }));
    const greatGrandling1InRoot1 = harness.run(greatGrandling1InRoot1VRef, null);
    expect(greatGrandling1InRoot1)
        .toBeTruthy();
    expect(harness.run(getGhostOwnling(), ["§->", "children", 1]))
        .toEqual(grandlingInRoot1VRef);
    expect(harness.run(grandlingInRoot1VRef, ["§->", "children", 0], { verbosity: 0 }))
        .toEqual(greatGrandling1InRoot1);
    expect(harness.run(greatGrandling1InRoot1, "name"))
        .toEqual("ghostGhostBaby");
  });

  describe("Plain (ie. no field mutations) Materialization or Immaterialization should not affect" +
     " Kueries in any way (except those which explicitly test for Materialization status)", () => {
    it("is true on materialization", () => {
      setUp({ verbosity: 0 });
      // Very basic case - test that the name of ghost grandling can be grabbed
      const firstResult = harness.run(
        vRef("root#1"), ["§->", "children", 0, "children", 0, "name"]
      );
      harness.chronicleEvent(createMaterializeGhostAction(harness.getState(), getGhostGrandling()));
      const secondResult = harness.run(
        vRef("root#1"), ["§->", "children", 0, "children", 0, "name"]
      );
      expect(firstResult)
          .toEqual(secondResult);
    });

    it("is true on immaterialization", () => {
      setUp({ verbosity: 0 });
      harness.chronicleEvent(createMaterializeGhostAction(harness.getState(), getGhostGrandling()));
      const firstResult = harness.run(
        vRef("root#1"), ["§->", "children", 0, "children", 0, "name"]
      );
      harness.chronicleEvent(
          createImmaterializeGhostAction(harness.getState(), getGhostGrandling()));
      const secondResult = harness.run(
        vRef("root#1"), ["§->", "children", 0, "children", 0, "name"]
      );
      expect(firstResult)
          .toEqual(secondResult);
    });
  });
});

describe("Mixing references across instantiation boundaries", () => {
  it("returns a sub-component of an instance prototype for an explicitly set instance field " +
      "instead of returning a ghost corresponding to this sub-component", () => {
    setUp({ verbosity: 0 });
    harness.chronicleEvent(fieldsSet({ id: "root#1", typeName: "TestThing",
      sets: { siblings: ["ownling"] },
    }));
    expect(harness.run(getTestPartition("root#1"), ["§->", "siblings", 0]))
        .toEqual(vRef("ownling"));
    expect(harness.run(getTestPartition("ownling"), ["§->", "siblings", 0]).rawId())
        .toEqual("root#1");
  });

  it("returns a sub-component of an instance prototype for an explicitly set ghost field " +
      "instead of returning a ghost corresponding to this sub-component", () => {
    setUp({ verbosity: 0 });
    harness.chronicleEvent(fieldsSet({ id: getGhostOwnling(), typeName: "TestThing",
      sets: { siblings: ["grandling"] },
    }));
    expect(harness.run(getGhostOwnling(), ["§->", "siblings", 0]))
        .toEqual(vRef("grandling"));
    expect(harness.run(getTestPartition("grandling"), ["§->", "siblings", 0]))
        .toEqual(getGhostOwnling());
  });

  it("returns the original resource for the *parent of *ownling", () => {
    setUp({ verbosity: 0 });
    expect(harness.run(getGhostOwnling(), ["§->", "parent", "rawId"]))
        .toEqual("root#1");
    expect(harness.run(getGhostGrandling(), ["§->", "parent", "parent", "rawId"]))
        .toEqual("root#1");
    expect(harness.run(getGhostGrandling(), ["§->", "parent"]))
        .toEqual(getGhostOwnling());
    expect(harness.run(getGhostGrandling(), ["§->", "parent", "parent", "rawId"]))
        .toEqual("root#1");
  });

  it("returns the original resource for the ghost host of various recursive ownlings", () => {
    setUp({ verbosity: 0 });
    expect(harness.run(getGhostOwnling(), ["§->", "ghostHost", "rawId"]))
        .toEqual("root#1");
    expect(harness.run(getGhostGrandling(), ["§->", "ghostHost", "rawId"]))
        .toEqual("root#1");
  });

  it("returns the original resource for complex instantiation chain parents and ghostHost", () => {
    setUp({ verbosity: 0, commands: createGrandlingInstance });
    expect(harness.run(vRef("grandling#1"), ["§->", "parent", "rawId"]))
        .toEqual("ownling");

    const grandling1InRoot1VRef =
        createGhostVRefInInstance(vRef("grandling#1"), getTestPartition("root#1"));
    expect(harness.run(grandling1InRoot1VRef, ["§->", "ghostHost", "rawId"]))
        .toEqual("root#1");
    expect(harness.run(grandling1InRoot1VRef, ["§->", "parent", "rawId"]))
        .toEqual(getGhostOwnling().rawId());

    const grandling1InRoot1ChildVRef = harness.run(grandling1InRoot1VRef, ["§->", "children", 0]);
    expect(harness.run(grandling1InRoot1ChildVRef, ["§->", "ghostHost", "rawId"]))
        .toEqual("root#1");
    expect(harness.run(grandling1InRoot1ChildVRef, ["§->", "parent", "rawId"]))
        .toEqual(grandling1InRoot1VRef.rawId());
    expect(harness.run(grandling1InRoot1ChildVRef, ["§->", "parent", "parent", "rawId"]))
        .toEqual(getGhostOwnling().rawId());
    expect(harness.run(grandling1InRoot1ChildVRef, ["§->", "parent", "parent", "parent", "rawId"]))
        .toEqual("root#1");
  });

  it("returns the original resource for child of an instance of a ghost", () => {
    setUp({ verbosity: 0 });
    const ownlingInRoot1VRef =
        createGhostVRefInInstance(vRef("ownling"), getTestPartition("root#1"));
    harness.chronicleEvent(created({ id: "ownlingIn1#1", typeName: "TestThing", initialState: {
      parent: "root#1",
      instancePrototype: ownlingInRoot1VRef,
    } }));
    expect(harness.run(vRef("ownlingIn1#1"), ["§->", "children", 0, "owner", "rawId"]))
        .toEqual("ownlingIn1#1");
  });
});

describe("Deep instantiations", () => {
  it("assigns a value on a Resource with an immaterial property", () => {
    setUp({ verbosity: 0, commands: createRootInstanceInstance });
    const grandling11 = harness.run(vRef("root#1#1"), ["§->", "children", 0, "children", 0]);
    expect(harness.run(grandling11, "name"))
        .toEqual("Harambe");
    harness.chronicleEvent(fieldsSet({ id: grandling11, typeName: "TestThing",
      sets: { name: "Ghostambe", },
    }));
    expect(harness.run(grandling11, "name"))
        .toEqual("Ghostambe");
    expect(harness.run(vRef("root#1#1"), ["§->", "children", 0, "children", 0, "name"]))
        .toEqual("Ghostambe");
  });

  it("assigns a value on an immaterial ownling of an instance of an ownling of an instance", () => {
    setUp({ verbosity: 0 });
    harness.chronicleEvent(created({ id: "grandMuck", typeName: "TestGlue", initialState: {
      source: "ownling",
      name: "muck",
    } }));
    harness.chronicleEvent(created({ id: "grandMuckPartition", typeName: "TestThing", initialState: {
      owner: "grandMuck",
      name: "muckPartition",
    } }));
    const ownlingIn1 = harness.run(vRef("root#1"), ["§->", "children", 0]);
    const grandMuckIn1 = harness.run(ownlingIn1, ["§->", "targetGlues", 0]);
    expect(harness.run(grandMuckIn1, ["§isghost", [null]]))
        .toEqual(true);
    expect(harness.run(grandMuckIn1, ["§isimmaterial", [null]]))
        .toEqual(true);
    const grandMukIn1i1 = vRef("grandMuckIn1#1");
    harness.chronicleEvent(created({ id: grandMukIn1i1, typeName: "TestGlue", initialState: {
      owner: ownlingIn1,
      instancePrototype: grandMuckIn1,
    } }));
    expect(harness.run(grandMuckIn1, ["§isghost", [null]]))
        .toEqual(true);
    expect(harness.run(grandMuckIn1, ["§isimmaterial", [null]]))
        .toEqual(false);
    expect(harness.run(grandMukIn1i1, ["§isghost", [null]]))
        .toEqual(false);
    expect(harness.run(grandMukIn1i1, ["§->", "unnamedOwnlings", 0, "name"]))
        .toEqual("muckPartition");
    expect(harness.run(grandMuckIn1, ["§->", "unnamedOwnlings", 0, "name"]))
        .toEqual("muckPartition");
    expect(harness.run(grandMukIn1i1, ["§->", "unnamedOwnlings", 0]))
        .not.toEqual(harness.run(grandMuckIn1, ["§->", "unnamedOwnlings", 0]));
  });

  it("handles a complex instantiation chain modifications", () => {
    setUp({ verbosity: 0, commands: [
      ...createGhostGrandlingInstance,
      ...createGrandlingInstance,
      ...createRootInstanceInstance,
    ] });
    const ownling11 = harness.run(vRef("root#1#1"), ["§->", "children", 0]);
    const grandling1 = getGrandlingInstance();
    const grandling11 = getGrandlingInstanceGhost();
    const grandling111 = getGrandlingInstanceGhostGhost();

    expect(harness.run(ownling11, "name"))
        .toEqual("Ownling");
    expect(harness.run(grandling11, "name"))
        .toEqual("Harambe");
    expect(harness.run(grandling111, "name"))
        .toEqual("Harambe");
    expect(harness.run(grandling11, ["§->", "children", ["§map", "prototype"]]))
        .toEqual(harness.run(grandling1, "children"));
    expect(harness.run(grandling111, ["§->", "children", ["§map", "prototype"]]))
        .toEqual(harness.run(grandling11, "children"));
    expect(harness.run(grandling111, ["§->", "children", ["§map", "prototype", "prototype"]]))
        .toEqual(harness.run(grandling1, "children"));

    harness.chronicleEvent(created({ id: "newGuy", typeName: "TestThing", initialState: {
      parent: "grandling#1", name: "New Guy",
    } }));

    expect(harness.run(grandling11, ["§->", "children", ["§map", "prototype"]]))
        .toEqual(harness.run(vRef("grandling#1"), "children"));  });
});
