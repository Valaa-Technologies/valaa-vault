import { created, modified, removedFromFields, replacedWithinFields } from "~/raem/command";
import getObjectTransient from "~/raem/tools/denormalized/getObjectTransient";
import getObjectField, { getObjectRawField } from "~/raem/tools/denormalized/getObjectField";
import { vRef, dRef } from "~/raem/ValaaReference";

import { createRAEMTestHarness } from "~/raem/test/RAEMTestHarness";

describe("MODIFIED", () => {
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
    created({ id: "A_child3", typeName: "TestThing",
      initialState: { owner: null },
    }),
  ];

  it("modify sets a singular literal", () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createBlockA, [
      modified({ id: "A_parent", typeName: "TestThing",
        sets: { name: "parent" },
      }),
    ]);
    expect(getObjectTransient(harness.corpus, "A_parent", "TestThing").get("name"))
        .toEqual("parent");
    expect(getObjectField(harness.corpus,
            getObjectTransient(harness.corpus, "A_parent", "TestThing"), "name"))
        .toEqual("parent");
  });

  it("modify sets a singular literal to null", () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createBlockA, [
      modified({ id: "A_parent", typeName: "TestThing", sets: { name: "parent" } }),
      modified({ id: "A_parent", typeName: "TestThing",
        sets: { name: null },
      }),
    ]);
    expect(getObjectTransient(harness.corpus, "A_parent", "TestThing").get("name"))
        .toEqual(null);
    expect(getObjectField(harness.corpus,
            getObjectTransient(harness.corpus, "A_parent", "TestThing"), "name"))
        .toEqual(null);
  });

  const createInstancesA = [
    created({ id: "A_parentInstance", typeName: "TestThing", initialState: {
      instancePrototype: "A_parent",
    } }),
  ];

  it("exposes prototype field list when getObjectRawField requests an unset instance field", () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createBlockA, createInstancesA);
    const parent = getObjectTransient(harness.corpus, "A_parent", "TestThing");
    const parentInstance = getObjectTransient(harness.corpus, "A_parentInstance", "TestThing");

    expect(getObjectRawField(harness.corpus, parentInstance, "children"))
        .toEqual(getObjectRawField(harness.corpus, parent, "children"));
    expect(getObjectField(harness.corpus, parentInstance, "children")
            .map(entry => entry.previousGhostStep().headRawId()))
        .toEqual(getObjectField(harness.corpus, parent, "children")
            .map(entry => entry.rawId()));
  });

  describe("Data manipulations", () => {
    it("adds and traverses non-expanded, string reference Data", () => {
      const harness = createRAEMTestHarness({ verbosity: 0 }, createBlockA);
      const dataGlue = harness.chronicleEvent(created({ id: "glue1", typeName: "TestDataGlue",
        initialState: { source: "A_child1", target: "A_child2" },
      })).getTruthEvent();
      harness.chronicleEvent(modified({ id: "A_child1", typeName: "TestThing",
        adds: { sourceDataGlues: [dataGlue.id] },
      }));

      const child1 = harness.run(vRef("A_child1"), null);
      expect(harness.run(child1, ["§->", "sourceDataGlues", 0, "target", "rawId"]))
          .toEqual("A_child2");
    });

    it("adds and traverses non-expanded ValaaReference Data", () => {
      const harness = createRAEMTestHarness({ verbosity: 0 }, createBlockA);
      const dataGlue = harness.chronicleEvent(created({ id: dRef("glue1"), typeName: "TestDataGlue",
        initialState: { source: "A_child1", target: "A_child2" },
      })).getTruthEvent();
      harness.chronicleEvent(modified({ id: "A_child1", typeName: "TestThing",
        adds: { sourceDataGlues: [dataGlue.id] },
      }));

      const child1 = harness.run(vRef("A_child1"), null);
      expect(harness.run(child1, ["§->", "sourceDataGlues", 0, "target", "rawId"]))
          .toEqual("A_child2");
    });

    it("adds and traverses expanded Data without explicit typeName to a concrete field", () => {
      const harness = createRAEMTestHarness({ verbosity: 0 }, createBlockA, [
        modified({ id: "A_child1", typeName: "TestThing",
          adds: { sourceDataGlues: [{ source: "A_child1", target: "A_child2" }] }
        }),
      ]);

      const child1 = harness.run(vRef("A_child1"), null);
      expect(harness.run(child1, ["§->", "sourceDataGlues", 0, "target", "rawId"]))
          .toEqual("A_child2");
    });

    it("fails to add expanded Data without explicit typeName to an abstract field", () => {
      const harness = createRAEMTestHarness({ verbosity: 0 }, createBlockA);
      expect(() => harness.chronicleEvent(modified({ id: "A_child1", typeName: "TestThing",
        adds: { targetDataGlues: [{ target: "A_child1", source: "A_child2" }] },
      }))).toThrow(/must have typeName field/);
    });

    it("adds and traverses expanded Data with explicit typeName to an abstract field", () => {
      const harness = createRAEMTestHarness({ verbosity: 0 }, createBlockA);
      harness.chronicleEvent(modified({ id: "A_child1", typeName: "TestThing",
        adds: { targetDataGlues: [{ typeName: "TestDataGlue",
          target: "A_child1", source: "A_child2",
        }], },
      }));

      const child1 = harness.run(vRef("A_child1"), null);
      expect(harness.run(child1, ["§->", "targetDataGlues", 0, "source", "rawId"]))
          .toEqual("A_child2");
    });

    it("deletes a field with REMOVED_FROM null", () => {
      const harness = createRAEMTestHarness({ verbosity: 0 }, createBlockA);
      expect(harness.run(vRef("A_child1"), "children"))
          .toEqual([]);
      expect(harness.run(vRef("A_parent"), "children"))
          .toEqual([vRef("A_child1"), vRef("A_child2")]);
      harness.chronicleEvent(removedFromFields({ id: "A_parent", typeName: "TestThing" },
          { children: null },
      ));
      expect(harness.run(vRef("A_parent"), "children"))
          .toEqual([]);
    });

    it("reorders with REPLACED_WITHIN", () => {
      const harness = createRAEMTestHarness({ verbosity: 0 }, createBlockA);
      expect(harness.run(vRef("A_parent"), "children"))
          .toEqual([vRef("A_child1"), vRef("A_child2")]);
      harness.chronicleEvent(replacedWithinFields({ id: "A_parent", typeName: "TestThing" },
          { children: [] }, { children: [vRef("A_child2"), vRef("A_child1")] },
      ));
      expect(harness.run(vRef("A_parent"), "children"))
          .toEqual([vRef("A_child2"), vRef("A_child1")]);
    });

    it("replaces some entries with REPLACED_WITHIN", () => {
      const harness = createRAEMTestHarness({ verbosity: 0 }, createBlockA);
      expect(harness.run(vRef("A_parent"), "children"))
          .toEqual([vRef("A_child1"), vRef("A_child2")]);
      harness.chronicleEvent(replacedWithinFields({ id: "A_parent", typeName: "TestThing" },
          { children: [vRef("A_child2")] }, { children: [vRef("A_child3"), vRef("A_child1")] },
      ));
      expect(harness.run(vRef("A_parent"), "children", { verbosity: 0 }))
          .toEqual([vRef("A_child3"), vRef("A_child1")]);
    });
  });
});
