import { created, duplicated } from "~/raem/command";
import { vRef } from "~/raem/ValaaReference";

import { createRAEMTestHarness } from "~/raem/test/RAEMTestHarness";

describe("CREATED/DUPLICATED", () => {
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

  it("DUPLICATED with initialState override", () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createBlockA, [
      duplicated({
        id: "A_parentCopy",
        duplicateOf: "A_parent",
        initialState: { name: "parent copy" },
      }),
    ]);
    expect(harness.run(vRef("A_parentCopy"), "name"))
        .toEqual("parent copy");
  });

  it("DUPLICATED mirrors ownership structure", () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createBlockA, [
      duplicated({
        id: "A_parentCopy",
        duplicateOf: "A_parent",
        initialState: { name: "structure-test copy" },
      }),
    ]);
    expect(harness.run(vRef("A_parentCopy"),
            ["§->", "name"]))
        .toEqual("structure-test copy");
    expect(harness.run(vRef("A_parentCopy"),
            ["§->", "children", 0, "owner", "name"]))
        .toEqual("structure-test copy");
    expect(harness.run(vRef("A_parentCopy"),
            ["§->", "children", 1, "owner", "name"]))
        .toEqual("structure-test copy");
  });
});
