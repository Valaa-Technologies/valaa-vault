import { created, modified } from "~/raem/command";
import { createRAEMTestHarness } from "~/raem/test/RAEMTestHarness";
import { vRef } from "~/raem/ValaaReference";

import snapshotPartition from "./snapshotPartition";

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
      source: "A_child1", target: "A_child2",
    }, }),
    created({ id: "A_childDataGlue", typeName: "TestDataGlue", initialState: {
      source: "A_child1", target: "A_child2",
    }, }),
    modified({ id: "A_child1", typeName: "TestThing", sets: {
      targetDataGlues: ["A_childDataGlue"],
    }, }),
    modified({ id: "A_child2", typeName: "TestThing", sets: {
      sourceDataGlues: ["A_childDataGlue"],
    }, }),
  ];
  /* TODO(iridian): Extend the tests to use this data.
  const createBlockB = [
    created({ id: "B_grandparent", typeName: "TestThing" }),
    created({ id: "B_parent", typeName: "TestThing",
      initialState: { owner: vRef("B_grandparent", "children") },
    }),
    created({ id: "B_child1", typeName: "TestThing",
      initialState: { owner: vRef("B_parent", "children") },
    }),
    created({ id: "B_child2", typeName: "TestThing",
      initialState: { owner: vRef("B_parent", "children") },
    }),
    created({ id: "B_childDataGlue", typeName: "TestDataGlue", initialState: {
      source: "B_child1", target: "B_child2",
    }, }),
    created({ id: "B_childGlue", typeName: "TestGlue", initialState: {
      source: "B_child1", target: "B_child2",
    }, }),
  ];
  */
  beforeEach(() => {
  });

  it("Should survive a simple snapshotting roundtrip", async () => {
    const harness = createRAEMTestHarness({ debug: 0 }, createBlockA, createBlockARest);
    const resultProclamations = [];

    // console.log("Store before roundtrip", beaumpify(store.getState()));

    await snapshotPartition({
      partitionId: "A_grandparent",
      state: harness.corpus.getState(),
      schema: harness.ContentAPI.schema,
      onCreated: (id, typeName, getInitialState) => {
        const createdProclamation = created({ id, typeName, initialState: getInitialState() });
        resultProclamations.push(createdProclamation);
      },
      onModified: (id, typeName, modifies) => {
        const modifiedProclamation = modified({ id, typeName, ...modifies });
        resultProclamations.push(modifiedProclamation);
      },
    });
    const resultHarness = createRAEMTestHarness({ debug: 0 }, resultProclamations);
    expect(resultHarness.corpus.getState().toJS())
        .toEqual(harness.corpus.getState().toJS());
  });
});
