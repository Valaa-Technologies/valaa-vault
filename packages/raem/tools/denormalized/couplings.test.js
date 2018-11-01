import { created, modified, destroyed, fieldsSet } from "~/raem/command";
import { createRAEMTestHarness } from "~/raem/test/RAEMTestHarness";
import { vRef } from "~/raem/ValaaReference";

import getObjectTransient, { tryObjectTransient }
    from "~/raem/tools/denormalized/getObjectTransient";

describe("Couplings", () => {
  beforeEach(() => {});

  const createBlockA = [
    created({ id: "A_grandparent", typeName: "TestThing" }),
    created({ id: "A_parent", typeName: "TestThing",
      initialState: { owner: vRef("A_grandparent", "children") },
    }),
    created({ id: "A_child1", typeName: "TestThing",
      initialState: { owner: vRef("A_parent", "children") },
    }),
    created({ id: "A_child2", typeName: "TestThing",
      initialState: { owner: vRef("A_parent", "children") },
    }),
  ];

  const createGlueA = [
    created({ id: "A_childGlue", typeName: "TestGlue", initialState: {
      source: "A_child1", target: "A_child2",
    }, }),
  ];

  it("forms ownership couplings on creation", () => {
    const state = createRAEMTestHarness({ verbosity: 0 }, createBlockA)
        .getState();

    expect(getObjectTransient(state, "A_grandparent", "TestThing").get("children").first())
        .toEqual(vRef("A_parent"));
    expect(getObjectTransient(state, "A_parent", "TestThing").get("owner"))
        .toEqual(vRef("A_grandparent", "children"));

    expect(getObjectTransient(state, "A_parent", "TestThing").get("children").first())
        .toEqual(vRef("A_child1"));
    expect(getObjectTransient(state, "A_child1", "TestThing").get("owner"))
        .toEqual(vRef("A_parent", "children"));

    expect(getObjectTransient(state, "A_parent", "TestThing").get("children").slice(1).first())
        .toEqual(vRef("A_child2"));
    expect(getObjectTransient(state, "A_child1", "TestThing").get("owner"))
        .toEqual(vRef("A_parent", "children"));
  });

  it("creates object with undefined owner property", () => {
    const state = createRAEMTestHarness({ verbosity: 0 }, createBlockA)
        .getState();
    expect(getObjectTransient(state, "A_grandparent", "TestThing").get("owner"))
        .toEqual(undefined);
  });

  it("denies cyclic ownership", () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createBlockA);
    expect(() => harness.chronicleEvent(fieldsSet({ id: "A_grandparent", typeName: "TestThing" },
      { owner: vRef("A_grandparent") },
    ))).toThrow(/Cyclic ownership not allowed.*parent/);
    expect(() => harness.chronicleEvent(fieldsSet({ id: "A_grandparent", typeName: "TestThing" },
      { owner: vRef("A_parent") },
    ))).toThrow(/Cyclic ownership not allowed.*grandparent/);
    expect(() => harness.chronicleEvent(fieldsSet({ id: "A_grandparent", typeName: "TestThing" },
      { owner: vRef("A_child1") },
    ))).toThrow(/Cyclic ownership not allowed.*grandgrandparent/);
    expect(() => harness.chronicleEvent(fieldsSet({ id: "A_child1", typeName: "TestThing" },
      { owner: vRef("A_child2") },
    ))).not.toThrow();
  });

  it("removes from owning coupling 'children' when ownee destroyed", () => {
    const state = createRAEMTestHarness({ verbosity: 0 }, createBlockA, [
      destroyed({ id: "A_child1", typeName: "TestThing" }),
    ]).getState();
    expect(getObjectTransient(state, "A_parent", "TestThing").get("children").first())
        .toEqual(vRef("A_child2"));
  });

  it("destroys ownee when owner destroyed", () => {
    const state = createRAEMTestHarness({ verbosity: 0 }, createBlockA, [
      destroyed({ id: "A_parent", typeName: "TestThing" }),
    ]).getState();
    expect(tryObjectTransient(state, "A_child1", "TestThing"))
        .toEqual(null);
    expect(tryObjectTransient(state, "A_child2", "TestThing"))
        .toEqual(null);
  });

  it("cascade-destroys grandownees when grandowner destroyed", () => {
    const state = createRAEMTestHarness({ verbosity: 0 }, createBlockA, createGlueA, [
      destroyed({ id: "A_grandparent", typeName: "TestThing" }),
    ]).getState();
    expect(tryObjectTransient(state, "A_parent", "TestThing"))
        .toEqual(null);
    expect(tryObjectTransient(state, "A_child1", "TestThing"))
        .toEqual(null);
    expect(tryObjectTransient(state, "A_child2", "TestThing"))
        .toEqual(null);
    expect(tryObjectTransient(state, "A_childGlue", "TestGlue"))
        .toEqual(null);
  });

  it("removes couplings when cascade-destroying", () => {
    const state = createRAEMTestHarness({ verbosity: 0 }, createBlockA, [
      created({ id: "A_orphan", typeName: "TestThing", initialState: {
        siblings: [vRef("A_child1"), vRef("A_child2")],
      } }),
      created({ id: "A_orphanGlue", typeName: "TestGlue", initialState: {
        target: vRef("A_child2"),
      } }),
      destroyed({ id: "A_grandparent", typeName: "TestThing" }),
    ]).getState();
    expect(tryObjectTransient(state, "A_parent", "TestThing"))
        .toEqual(null);
    expect(tryObjectTransient(state, "A_child1", "TestThing"))
        .toEqual(null);
    expect(tryObjectTransient(state, "A_child2", "TestThing"))
        .toEqual(null);
    // Coupling removal never removes fields but leaves them as empty arrays or nulls.
    // Otherwise the removal might uncover ghost prototype fields.
    expect(getObjectTransient(state, "A_orphan", "TestThing").get("siblings").size)
        .toEqual(0);
    expect(getObjectTransient(state, "A_orphanGlue", "TestGlue").get("target"))
        .toEqual(null);
  });

  it("destroys ownee when owner coupling is removed from owner side", () => {
    const state = createRAEMTestHarness({ verbosity: 0 }, createBlockA, [
      modified({ id: "A_parent", typeName: "TestThing",
        removes: { children: [vRef("A_child1")] }
      }),
    ]).getState();
    expect(tryObjectTransient(state, "A_child1", "TestThing"))
        .toEqual(null);
    expect(getObjectTransient(state, "A_parent", "TestThing").get("children").first())
        .toEqual(vRef("A_child2"));
  });

  it("orphans ownee when ownership coupling is removed from ownee side", () => {
    const state = createRAEMTestHarness({ verbosity: 0 }, createBlockA, [
      modified({ id: "A_parent", typeName: "TestThing",
        sets: { owner: null }, }),
    ]).getState();
    expect(getObjectTransient(state, "A_grandparent", "TestThing").get("children").size)
        .toEqual(0);
    expect(getObjectTransient(state, "A_parent", "TestThing"))
        .toBeTruthy();
    expect(getObjectTransient(state, "A_parent", "TestThing").get("owner"))
        .toEqual(null);
  });

  it("adopts orphan when an ownership coupling is created on the ownee side", () => {
    const state = createRAEMTestHarness({ verbosity: 0 }, createBlockA, [
      modified({ id: "A_parent", typeName: "TestThing",
        sets: { owner: null }, }),
      modified({ id: "A_parent", typeName: "TestThing",
        sets: { owner: vRef("A_grandparent", "children") }, }),
    ]).getState();
    expect(getObjectTransient(state, "A_grandparent", "TestThing").get("children").size)
        .toEqual(1);
    expect(getObjectTransient(state, "A_parent", "TestThing"))
        .toBeTruthy();
    expect(getObjectTransient(state, "A_parent", "TestThing").get("owner"))
        .toEqual(vRef("A_grandparent", "children"));
  });

  it("adopts orphan when an ownership coupling is created on the owner side", () => {
    const state = createRAEMTestHarness({ verbosity: 0 }, createBlockA, [
      modified({ id: "A_parent", typeName: "TestThing",
        sets: { owner: null }, }),
      modified({ id: "A_grandparent", typeName: "TestThing",
        adds: { children: ["A_parent"] }, }),
    ]).getState();
    expect(getObjectTransient(state, "A_grandparent", "TestThing").get("children").size)
        .toEqual(1);
    expect(getObjectTransient(state, "A_parent", "TestThing"))
        .toBeTruthy();
    expect(getObjectTransient(state, "A_parent", "TestThing").get("owner"))
        .toEqual(vRef("A_grandparent", "children"));
  });

  it("forms non-ownership couplings on creation", () => {
    const state = createRAEMTestHarness({ verbosity: 0 }, createBlockA, createGlueA)
        .getState();
    expect(getObjectTransient(state, "A_child1", "TestThing").get("targetGlues").first())
        .toEqual(vRef("A_childGlue"));
    expect(getObjectTransient(state, "A_child2", "TestThing").get("sourceGlues").first())
        .toEqual(vRef("A_childGlue"));
  });

  it("removes non-owning singular coupling when other side resource is destroyed", () => {
    const state = createRAEMTestHarness({ verbosity: 0 }, createBlockA, createGlueA, [
      destroyed({ id: "A_child2", typeName: "TestThing" }),
    ]).getState();
    expect(getObjectTransient(state, "A_childGlue", "TestGlue").get("target"))
        .toEqual(null);
  });

  it("removes non-owner plural coupling when other side resource is destroyed", () => {
    const state = createRAEMTestHarness({ verbosity: 0 }, createBlockA, createGlueA, [
      destroyed({ id: "A_childGlue", typeName: "TestGlue" }),
    ]).getState();
    expect(getObjectTransient(state, "A_child2", "TestThing").get("sourceGlues").size)
        .toEqual(0);
  });

  it("creates symmetric 'sibling' couplings properly", () => {
    const state = createRAEMTestHarness({ verbosity: 0 }, createBlockA, [
      created({ id: "A_child3", typeName: "TestThing", initialState: {
        siblings: [vRef("A_child1"), vRef("A_child2")],
      }, }),
    ]).getState();
    expect(getObjectTransient(state, "A_child1", "TestThing").get("siblings").first())
        .toEqual(vRef("A_child3"));
    expect(getObjectTransient(state, "A_child2", "TestThing").get("siblings").first())
        .toEqual(vRef("A_child3"));
  });

  it("modifies symmetric 'sibling' couplings properly", () => {
    const state = createRAEMTestHarness({ verbosity: 0 }, createBlockA, [
      modified({ id: "A_child1", typeName: "TestThing", sets: {
        siblings: [vRef("A_child2")],
      }, }),
    ]).getState();
    expect(getObjectTransient(state, "A_child1", "TestThing").get("siblings").first())
        .toEqual(vRef("A_child2"));
    expect(getObjectTransient(state, "A_child2", "TestThing").get("siblings").first())
        .toEqual(vRef("A_child1"));
  });

  it("removes symmetric 'sibling' coupling when other side resource is destroyed", () => {
    const state = createRAEMTestHarness({ verbosity: 0 }, createBlockA, [
      created({ id: "A_child3", typeName: "TestThing", initialState: {
        siblings: [vRef("A_child1"), vRef("A_child2")],
      }, }),
      destroyed({ id: "A_child3", typeName: "TestThing" }),
    ]).getState();
    expect(getObjectTransient(state, "A_child1", "TestThing").get("siblings").size)
        .toEqual(0);
    expect(getObjectTransient(state, "A_child2", "TestThing").get("siblings").size)
        .toEqual(0);
  });

  it("uses 'unnamedCouplings' by default for couplings missing explicit remote", () => {
    const state = createRAEMTestHarness({ verbosity: 0 }, createBlockA, [
      created({ id: "A_childGlue", typeName: "TestGlue", initialState: {
        dangling: vRef("A_child2"),
      }, }),
    ]).getState();
    expect(getObjectTransient(state, "A_childGlue", "TestGlue").get("dangling"))
        .toEqual(vRef("A_child2"));
    expect(getObjectTransient(state, "A_child2", "TestThing").get("unnamedCouplings").first())
        .toEqual(vRef("A_childGlue", "dangling"));
  });

  it("removes unnamed coupling when other side resource is destroyed", () => {
    const state = createRAEMTestHarness({ verbosity: 0 }, createBlockA, [
      created({ id: "A_childGlue", typeName: "TestGlue", initialState: {
        dangling: vRef("A_child2"),
      }, }),
      destroyed({ id: "A_childGlue", typeName: "TestGlue" }),
    ]).getState();
    expect(getObjectTransient(state, "A_child2", "TestThing").get("unnamedCouplings").size)
        .toEqual(0);
  });

  it("removes unnamed coupling when other side resource is destroyed", () => {
    const state = createRAEMTestHarness({ verbosity: 0 }, createBlockA, [
      created({ id: "A_childGlue", typeName: "TestGlue", initialState: {
        dangling: vRef("A_child2"),
      }, }),
      destroyed({ id: "A_child2", typeName: "TestThing" }),
    ]).getState();
    expect(getObjectTransient(state, "A_childGlue", "TestGlue").get("dangling"))
        .toEqual(null);
  });

  it("creates a resource with owner alias set to null", () => {
    const state = createRAEMTestHarness({ verbosity: 0 }, [
      created({ id: "A_orphanGlue", typeName: "TestGlue",
        initialState: { source: null },
      }),
    ]).getState();
    expect(getObjectTransient(state, "A_orphanGlue", "TestGlue").get("owner"))
        .toEqual(null);
  });

  it("sets owner alias to null", () => {
    const state = createRAEMTestHarness({ verbosity: 0 }, createBlockA, createGlueA, [modified({
      id: "A_childGlue", typeName: "TestGlue",
      sets: { source: null },
    })]).getState();
    expect(getObjectTransient(state, "A_childGlue", "TestGlue").get("owner"))
        .toEqual(null);
  });

  it("updates previous source children when source is changed directly", () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createBlockA, createGlueA);
    expect(harness.run(vRef("A_childGlue"), "source"))
        .toEqual(vRef("A_child1"));
    expect(harness.run(vRef("A_childGlue"), "owner"))
        .toEqual(vRef("A_child1"));
    expect(harness.run(vRef("A_childGlue"), ["§coupling", ["owner"]]))
        .toEqual("targetGlues");
    expect(harness.run(vRef("A_child1"), "targetGlues"))
        .toEqual([vRef("A_childGlue")]);
    harness.chronicleEvent(modified({ id: "A_childGlue", typeName: "TestGlue",
      sets: { source: "A_child2" },
    }));
    expect(harness.run(vRef("A_childGlue"), "source"))
        .toEqual(vRef("A_child2"));
    expect(harness.run(vRef("A_childGlue"), "owner"))
        .toEqual(vRef("A_child2"));
    expect(harness.run(vRef("A_child1"), "targetGlues"))
        .toEqual([]);
    expect(harness.run(vRef("A_child2"), "targetGlues"))
        .toEqual([vRef("A_childGlue")]);
  });

  it("updates previous source children when source is changed through owner", () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createBlockA, createGlueA);
    harness.chronicleEvent(modified({ id: "A_childGlue", typeName: "TestGlue",
      sets: { owner: vRef("A_child2", "targetGlues") },
    }));
    expect(harness.run(vRef("A_childGlue"), "source"))
        .toEqual(vRef("A_child2"));
    expect(harness.run(vRef("A_childGlue"), "owner"))
        .toEqual(vRef("A_child2"));
    expect(harness.run(vRef("A_childGlue"), ["§coupling", ["owner"]]))
        .toEqual("targetGlues");
    expect(harness.run(vRef("A_child1"), "targetGlues"))
        .toEqual([]);
    expect(harness.run(vRef("A_child2"), "targetGlues"))
        .toEqual([vRef("A_childGlue")]);
  });

  it("updates binding fields when owner/source are altered several times in various ways", () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createBlockA, createGlueA);
    harness.chronicleEvent(modified({ id: "A_childGlue", typeName: "TestGlue",
      sets: { owner: vRef("A_child2") },
    }));
    expect(harness.run(vRef("A_childGlue"), ["§coupling", ["owner"]]))
        .toEqual("unnamedOwnlings");
    expect(harness.run(vRef("A_childGlue"), "source"))
        .toEqual(undefined);
    expect(harness.run(vRef("A_childGlue"), "owner"))
        .toEqual(vRef("A_child2"));
    expect(harness.run(vRef("A_child1"), "targetGlues"))
        .toEqual([]);
    expect(harness.run(vRef("A_child2"), "targetGlues"))
        .toEqual([]);
    expect(harness.run(vRef("A_child2"), "unnamedOwnlings"))
        .toEqual([vRef("A_childGlue")]);
    harness.chronicleEvent(modified({ id: "A_childGlue", typeName: "TestGlue",
      sets: { owner: vRef("A_child1") },
    }));
    expect(harness.run(vRef("A_childGlue"), ["§coupling", ["owner"]]))
        .toEqual("unnamedOwnlings");
    expect(harness.run(vRef("A_childGlue"), "source"))
        .toEqual(undefined);
    expect(harness.run(vRef("A_childGlue"), "owner"))
        .toEqual(vRef("A_child1"));
    expect(harness.run(vRef("A_child1"), "unnamedOwnlings"))
        .toEqual([vRef("A_childGlue")]);
    expect(harness.run(vRef("A_child2"), "unnamedOwnlings"))
        .toEqual([]);
    expect(harness.run(vRef("A_child1"), "targetGlues"))
        .toEqual([]);
    expect(harness.run(vRef("A_child2"), "targetGlues"))
        .toEqual([]);
    harness.chronicleEvent(modified({ id: "A_childGlue", typeName: "TestGlue",
      sets: { source: vRef("A_child2") },
    }));
    expect(harness.run(vRef("A_childGlue"), "source"))
        .toEqual(vRef("A_child2"));
    expect(harness.run(vRef("A_childGlue"), "owner"))
        .toEqual(vRef("A_child2"));
    expect(harness.run(vRef("A_childGlue"), ["§coupling", ["owner"]]))
        .toEqual("targetGlues");
    expect(harness.run(vRef("A_child1"), "unnamedOwnlings"))
        .toEqual([]);
    expect(harness.run(vRef("A_child2"), "unnamedOwnlings"))
        .toEqual([]);
    expect(harness.run(vRef("A_child1"), "targetGlues"))
        .toEqual([]);
    expect(harness.run(vRef("A_child2"), "targetGlues"))
        .toEqual([vRef("A_childGlue")]);
  });

  it("performs a complex instantiation&move sequence while maintaining correct couplings", () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createBlockA, createGlueA);
    const childGlue = vRef("A_childGlue");
    expect(harness.run(childGlue, ["§coupling", ["owner"]]))
        .toEqual("targetGlues");
    expect(harness.run(vRef("A_child1"), "targetGlues"))
        .toEqual([childGlue]);
    const parent1 = vRef("A_parent#1");
    harness.chronicleEvent(created({ id: parent1, typeName: "TestThing", initialState: {
      owner: vRef("A_grandparent"),
      instancePrototype: vRef("A_parent"),
    } }));
    const childAInParent1 = harness.run(vRef("A_parent#1"), ["§->", "children", 0]);
    const childBInParent1 = harness.run(vRef("A_parent#1"), ["§->", "children", 1]);
    const glueInParent1 = harness.run(childAInParent1, ["§->", "targetGlues", 0]);
    expect(harness.run(glueInParent1, ["§coupling", ["owner"]]))
        .toEqual("targetGlues");
    expect(harness.run(childAInParent1, "targetGlues").map(entry => entry.rawId()))
        .toEqual([glueInParent1.rawId()]);

    const glue1InParent1 = vRef("A_childGlueInParent#1_#1");
    harness.chronicleEvent(created({ id: glue1InParent1, typeName: "TestGlue", initialState: {
      owner: childAInParent1,
      instancePrototype: glueInParent1,
    } }));
    expect(harness.run(glue1InParent1, ["§coupling", ["owner"]]))
        .toEqual("unnamedOwnlings");
    expect(harness.run(childAInParent1, "targetGlues").map(entry => entry.rawId()))
        .toEqual([glueInParent1.rawId()]);
    expect(harness.run(childAInParent1, "unnamedOwnlings").map(entry => entry.rawId()))
        .toEqual([glue1InParent1.rawId()]);

    harness.chronicleEvent(modified({ id: glue1InParent1, typeName: "TestGlue",
      sets: { source: childBInParent1 },
    }));
    expect(harness.run(glue1InParent1, ["§coupling", ["owner"]]))
        .toEqual("targetGlues");

    expect(harness.run(childAInParent1, "unnamedOwnlings").map(entry => entry.rawId()))
        .toEqual([]);
    expect(harness.run(childBInParent1, "unnamedOwnlings").map(entry => entry.rawId()))
        .toEqual([]);
    expect(harness.run(childAInParent1, "targetGlues").map(entry => entry.rawId()))
        .toEqual([glueInParent1.rawId()]);
    expect(harness.run(childBInParent1, "targetGlues").map(entry => entry.rawId()))
        .toEqual([glue1InParent1.rawId()]);
  });

  it("assigns the same owner but with different couplings", () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createBlockA, createGlueA);
    const childGlue = vRef("A_childGlue");
    expect(harness.run(childGlue, ["§coupling", ["owner"]]))
        .toEqual("targetGlues");
    harness.chronicleEvent(modified({ id: childGlue, typeName: "TestGlue",
      sets: { owner: "A_child1" },
    }));
    expect(harness.run(childGlue, ["§coupling", ["owner"]]))
        .toEqual("unnamedOwnlings");
    expect(harness.run(vRef("A_child1"), "targetGlues").map(entry => entry.rawId()))
        .toEqual([]);
    expect(harness.run(vRef("A_child1"), "unnamedOwnlings").map(entry => entry.rawId()))
        .toEqual(["A_childGlue"]);
    harness.chronicleEvent(modified({ id: childGlue, typeName: "TestGlue",
      sets: { owner: vRef("A_child1", "unnamedOwnlings") },
    }));
    expect(harness.run(childGlue, ["§coupling", ["owner"]]))
        .toEqual("unnamedOwnlings");
    expect(harness.run(vRef("A_child1"), "targetGlues").map(entry => entry.rawId()))
        .toEqual([]);
    expect(harness.run(vRef("A_child1"), "unnamedOwnlings").map(entry => entry.rawId()))
        .toEqual(["A_childGlue"]);
  });

  it("maintains all couplings when a ghost's owner is changed within instance", async () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createBlockA, [
      created({ id: "A_grandparentInstance", typeName: "TestThing",
        initialState: { instancePrototype: "A_grandparent" },
      }),
    ]);
    const parentInInstance = harness.run(vRef("A_grandparentInstance"), ["§->", "children", 0]);
    expect(harness.run(parentInInstance, "owner").rawId())
        .toEqual("A_grandparentInstance");

    const child1InInstance = harness.run(parentInInstance, ["§->", "children", 0]);
    expect(harness.run(child1InInstance, "owner").rawId())
        .toEqual(parentInInstance.rawId());

    const child2InInstance = harness.run(parentInInstance, ["§->", "children", 1]);
    expect(harness.run(child2InInstance, "owner").rawId())
        .toEqual(parentInInstance.rawId());

    expect(harness.run(child1InInstance, "prototype").rawId())
        .toEqual("A_child1");
    expect(harness.run(child1InInstance, "owner").rawId())
        .toEqual(parentInInstance.rawId());
    expect(harness.run(child1InInstance, ["§coupling", ["owner"]]))
        .toEqual("children");
    expect(harness.run(parentInInstance, "children").map(entry => entry.rawId()))
        .toEqual([child1InInstance.rawId(), child2InInstance.rawId()]);
    expect(harness.run(child2InInstance, "children").map(entry => entry.rawId()))
        .toEqual([]);
    expect(harness.run(parentInInstance, "unnamedOwnlings").map(entry => entry.rawId()))
        .toEqual([]);
    expect(harness.run(child2InInstance, "unnamedOwnlings").map(entry => entry.rawId()))
        .toEqual([]);

    harness.chronicleEvent(modified({ id: child1InInstance, typeName: "TestThing",
      sets: { parent: child2InInstance },
    }));
    expect(harness.run(child1InInstance, "owner").rawId())
        .toEqual(child2InInstance.rawId());
    expect(harness.run(child1InInstance, ["§coupling", ["owner"]]))
        .toEqual("children");
    expect(harness.run(parentInInstance, "children").map(entry => entry.rawId()))
        .toEqual([child2InInstance.rawId()]);
    expect(harness.run(child2InInstance, "children").map(entry => entry.rawId()))
        .toEqual([child1InInstance.rawId()]);
    expect(harness.run(parentInInstance, "unnamedOwnlings").map(entry => entry.rawId()))
        .toEqual([]);
    expect(harness.run(child2InInstance, "unnamedOwnlings").map(entry => entry.rawId()))
        .toEqual([]);

    harness.chronicleEvent(modified({ id: child1InInstance, typeName: "TestThing",
      sets: { owner: parentInInstance },
    }));
    expect(harness.run(child1InInstance, "owner").rawId())
        .toEqual(parentInInstance.rawId());
    expect(harness.run(child1InInstance, ["§coupling", ["owner"]]))
        .toEqual("unnamedOwnlings");
    expect(harness.run(parentInInstance, "children").map(entry => entry.rawId()))
        .toEqual([child2InInstance.rawId()]);
    expect(harness.run(child2InInstance, "children").map(entry => entry.rawId()))
        .toEqual([]);
    expect(harness.run(parentInInstance, "unnamedOwnlings").map(entry => entry.rawId()))
        .toEqual([child1InInstance.rawId()]);
    expect(harness.run(child2InInstance, "unnamedOwnlings").map(entry => entry.rawId()))
        .toEqual([]);

    harness.chronicleEvent(modified({ id: child1InInstance, typeName: "TestThing",
      sets: { owner: child2InInstance },
    }));
    expect(harness.run(child1InInstance, "owner").rawId())
        .toEqual(child2InInstance.rawId());
    expect(harness.run(child1InInstance, ["§coupling", ["owner"]]))
        .toEqual("unnamedOwnlings");
    expect(harness.run(parentInInstance, "children").map(entry => entry.rawId()))
        .toEqual([child2InInstance.rawId()]);
    expect(harness.run(child2InInstance, "children").map(entry => entry.rawId()))
        .toEqual([]);
    expect(harness.run(parentInInstance, "unnamedOwnlings").map(entry => entry.rawId()))
        .toEqual([]);
    expect(harness.run(child2InInstance, "unnamedOwnlings").map(entry => entry.rawId()))
        .toEqual([child1InInstance.rawId()]);

    harness.chronicleEvent(modified({ id: child1InInstance, typeName: "TestThing",
      sets: { owner: parentInInstance.coupleWith("children") },
    }));

    expect(harness.run(child1InInstance, "owner").rawId())
        .toEqual(parentInInstance.rawId());
    expect(harness.run(child1InInstance, ["§coupling", ["owner"]]))
        .toEqual("children");
    expect(harness.run(parentInInstance, "children").map(entry => entry.rawId()))
        .toEqual([child2InInstance.rawId(), child1InInstance.rawId()]);
    expect(harness.run(child2InInstance, "children").map(entry => entry.rawId()))
        .toEqual([]);
    expect(harness.run(parentInInstance, "unnamedOwnlings").map(entry => entry.rawId()))
        .toEqual([]);
    expect(harness.run(child2InInstance, "unnamedOwnlings").map(entry => entry.rawId()))
        .toEqual([]);
  });
});
