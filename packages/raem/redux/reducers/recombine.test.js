import { created, duplicated, recombined } from "~/raem/events";
import { vRef } from "~/raem/ValaaReference";

import { createRAEMTestHarness } from "~/raem/test/RAEMTestHarness";

describe("RECOMBINED", () => {
  beforeEach(() => {});

  const createBlockA = [
    created({ id: "A_grandparent", typeName: "TestThing" }),
    created({ id: "A_parent", typeName: "TestThing",
      initialState: { parent: vRef("A_grandparent") },
    }),
    created({ id: "A_child1", typeName: "TestThing",
      initialState: { name: "child1", parent: vRef("A_parent") },
    }),
    created({ id: "A_child2", typeName: "TestThing",
      // child2 is asymmetric with child1 and does not have a name
      initialState: { parent: vRef("A_parent") },
    }),
    created({ id: "A_child1GlueChild2", typeName: "TestGlue",
      initialState: { source: vRef("A_child1"), target: vRef("A_child2") },
    }),
    created({ id: "A_child2GlueChild1", typeName: "TestGlue",
      initialState: { source: vRef("A_child2"), target: vRef("A_child1") },
    }),
  ];

  it("handles top-level sibling duplicate cross-references properly", () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createBlockA, [
      recombined({
        actions: [
          duplicated({ id: "A_child1Copy",
            duplicateOf: "A_child1",
            initialState: { name: "child1 copy" },
          }),
          duplicated({ id: "A_child2Copy",
            duplicateOf: "A_child2",
            initialState: { name: "child2 copy" },
          }),
        ]
      })
    ]);
    expect(harness.run(vRef("A_child1Copy"), "owner"))
        .toEqual(vRef("A_parent"));
    expect(harness.run(vRef("A_child2Copy"), "owner"))
        .toEqual(vRef("A_parent"));
    expect(harness.run(vRef("A_child1"), "name"))
        .toEqual("child1");
    expect(harness.run(vRef("A_child2"), "name"))
        .toEqual("");
    expect(harness.run(vRef("A_child1Copy"), "name"))
        .toEqual("child1 copy");
    expect(harness.run(vRef("A_child2Copy"), "name"))
        .toEqual("child2 copy");
    expect(harness.run(vRef("A_child1Copy"), ["§->", "targetGlues"]).length)
        .toEqual(1);
    expect(harness.run(vRef("A_child1Copy"), ["§->", "sourceGlues"]).length)
        .toEqual(1);
    expect(harness.run(vRef("A_child2Copy"), ["§->", "targetGlues"]).length)
        .toEqual(1);
    expect(harness.run(vRef("A_child2Copy"), ["§->", "sourceGlues"]).length)
        .toEqual(1);
    expect(harness.run(vRef("A_child1Copy"), ["§->", "targetGlues", 0, "target"]))
        .toEqual(vRef("A_child2Copy"));
    expect(harness.run(vRef("A_child1Copy"), ["§->", "sourceGlues", 0, "source"]))
        .toEqual(vRef("A_child2Copy"));
    expect(harness.run(vRef("A_child2Copy"), ["§->", "targetGlues", 0, "target"]))
        .toEqual(vRef("A_child1Copy"));
    expect(harness.run(vRef("A_child2Copy"), ["§->", "sourceGlues", 0, "source"]))
        .toEqual(vRef("A_child1Copy"));
  });

  it("customizes cherry-picked sub-resources with id and initialState overrides", () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createBlockA, [
      recombined({
        actions: [
          duplicated({
            id: "A_parentCopy",
            duplicateOf: "A_parent",
            initialState: { name: "parent copy" },
          }),
          duplicated({
            id: "A_child2Copy",
            duplicateOf: "A_child2",
            initialState: { name: "child2 copy" },
          }),
        ],
      }),
    ]);
    expect(harness.run(vRef("A_parentCopy"), "name"))
        .toEqual("parent copy");
    const childCopies = harness.run(vRef("A_parentCopy"), ["§->", "children"]);
    expect(childCopies[0])
        .not.toEqual(vRef("A_child1"));
    expect(harness.run(childCopies[0], "name"))
        .toEqual("child1");
    expect(childCopies[1])
        .toEqual(vRef("A_child2Copy"));
    expect(harness.run(childCopies[1], "name"))
        .toEqual("child2 copy");
    expect(harness.run(childCopies[0], "name"))
        .toEqual("child1");
    expect(harness.run(childCopies[1], "name"))
        .toEqual("child2 copy");
    expect(harness.run(childCopies[0], "parent"))
        .toEqual(vRef("A_parentCopy"));
    expect(harness.run(childCopies[1], "parent"))
        .toEqual(vRef("A_parentCopy"));
    expect(harness.run(childCopies[0], ["§->", "targetGlues", 0, "target"]))
        .toEqual(childCopies[1]);
    expect(harness.run(childCopies[0], ["§->", "sourceGlues", 0, "source"]))
        .toEqual(childCopies[1]);
    expect(harness.run(childCopies[1], ["§->", "targetGlues", 0, "target"]))
        .toEqual(childCopies[0]);
    expect(harness.run(childCopies[1], ["§->", "sourceGlues", 0, "source"]))
        .toEqual(childCopies[0]);
  });

  it("omits sub-component duplication with id = null in a sub-directive", () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createBlockA, [
      recombined({
        actions: [
          duplicated({
            id: "A_parentCopy",
            duplicateOf: "A_parent",
            initialState: { name: "parent copy" },
          }),
          duplicated({
            id: null,
            duplicateOf: "A_child2",
          }),
        ],
      }),
    ]);
    expect(harness.run(vRef("A_parentCopy"), "name"))
        .toEqual("parent copy");
    const childCopies = harness.run(vRef("A_parentCopy"), ["§->", "children"]);
    expect(childCopies.length)
        .toEqual(1);
    expect(childCopies[0])
        .not.toEqual(vRef("A_child1"));
    expect(harness.run(childCopies[0], "name"))
        .toEqual("child1");
    const child1GlueCopy = harness.run(childCopies[0], ["§->", "targetGlues", 0]);
    expect(child1GlueCopy.rawId())
        .not.toEqual("A_child1GlueChild2");
    expect(harness.run(child1GlueCopy, "target"))
        .toEqual(vRef("A_child2"));
  });

  it("restructures with sub-directive preOverrides.owner", () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createBlockA, [
      recombined({
        actions: [
          duplicated({
            id: "A_parentCopy",
            duplicateOf: "A_parent",
            initialState: { name: "parent copy" },
          }),
          duplicated({
            id: "A_child2Copy",
            duplicateOf: "A_child2",
            preOverrides: { owner: vRef("A_child1", "children") },
          }),
        ],
      }),
    ]);
    expect(harness.run(vRef("A_parentCopy"), "name"))
        .toEqual("parent copy");
    const parentCopyChildren = harness.run(vRef("A_parentCopy"), ["§->", "children"]);
    expect(parentCopyChildren.length)
        .toEqual(1);
    expect(parentCopyChildren[0])
        .not.toEqual(vRef("A_child1"));
    expect(harness.run(parentCopyChildren[0], "name"))
        .toEqual("child1");
    const childCopyChildren = harness.run(parentCopyChildren[0], ["§->", "children"]);
    expect(childCopyChildren.length)
        .toEqual(1);
    expect(childCopyChildren[0])
        .toEqual(vRef("A_child2Copy"));
    const child1GlueCopy = harness.run(parentCopyChildren[0], ["§->", "targetGlues", 0]);
    expect(child1GlueCopy.rawId())
        .not.toEqual("A_child1GlueChild2");
    expect(harness.run(child1GlueCopy, "target"))
        .toEqual(vRef("A_child2Copy"));
  });
});
