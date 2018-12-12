// @flow

import { vRef } from "~/raem/ValaaReference";

import { created, destroyed } from "~/raem/events";

import { tryObjectTransient } from "~/raem/state/getObjectTransient";

import { createRAEMTestHarness } from "~/raem/test/RAEMTestHarness";

describe("CREATED/DUPLICATED", () => {
  beforeEach(() => {});

  const createBlockA = [
    created({ id: ["A_grandparent"], typeName: "TestThing" }),
    created({ id: ["A_parent"], typeName: "TestThing",
      initialState: { owner: vRef("A_grandparent", "children") },
    }),
    created({ id: ["A_child1"], typeName: "TestThing",
      initialState: { owner: vRef("A_parent", "children") },
    }),
    created({ id: ["A_child2"], typeName: "TestThing",
      initialState: { owner: vRef("A_parent", "children"), name: "child2" },
    }),
    created({ id: ["A_child2+1"], typeName: "TestThing",
      initialState: {
        instancePrototype: vRef("A_child2"), name: "child2#2", owner: vRef("A_parent", "children"),
      },
    }),
  ];

  it("doesn't find resource after dispatching DESTROYED", () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createBlockA, [
      destroyed({ id: ["A_child1"] }),
    ]);
    expect(tryObjectTransient(harness.getState(), "A_child1", "Resource"))
        .toEqual(null);
  });

  it("prevents DESTROYED if the resource has active instances", () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createBlockA);
    expect(() => harness.chronicleEvent(destroyed({ id: ["A_child2"] })))
        .toThrow(/destruction blocked/);
  });

  it("doesn't prevent DESTROYED if a preventing instance will also be destroyed", () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createBlockA);
    expect(() => harness.chronicleEvent(destroyed({ id: ["A_parent"] })))
        .not.toThrow(/destruction blocked/);
  });

  it("doesn't prevent DESTROYED for non-command", () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createBlockA);
    expect(() => harness.chronicleEvent(destroyed({ id: ["A_child2"],
      local: { isBeingUniversalized: false },
    }))).not.toThrow(/destruction blocked/);
  });
});
