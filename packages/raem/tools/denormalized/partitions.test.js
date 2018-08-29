// @flow
import { created, addedToFields, transacted } from "~/raem/command";
import { vRef } from "~/raem/ValaaReference";

import { createRAEMTestHarness } from "~/raem/test/RAEMTestHarness";
import { createLocalPartitionURIFromRawId, createMemoryPartitionURIFromRawId }
    from "~/raem/ValaaURI";

const testAuthorityURI = "valaa-test:";
// const sharedURI = "valaa-shared-content";

/*
function vCrossRef (rawId, partitionRawId = rawId) {
  const uri = createPartitionURI("valaa-test:", partitionRawId);
  return vRef(rawId, null, null, uri);
}
*/

describe("partitions", () => {
  beforeEach(() => {});

  const createBlockA = [
    // LocalPartition is implicitly created
    created({ id: "A_grandparent", typeName: "TestThing",
      initialState: {
        partitionAuthorityURI: "valaa-local:"
      },
    }),
    created({ id: "A_parent", typeName: "TestThing",
      initialState: { owner: vRef("A_grandparent", "children") },
    }),
    created({ id: "A_child1", typeName: "TestThing",
      initialState: { owner: vRef("A_parent", "children") },
    }),
    created({ id: "A_child2", typeName: "TestThing",
      initialState: {
        owner: vRef("A_parent", "children"),
        partitionAuthorityURI: "valaa-memory:",
      },
    }),
    created({ id: "A_grandchild", typeName: "TestThing",
      initialState: {
        owner: vRef("A_child2", "children"),
      },
    }),
    created({ id: "A_grandownee", typeName: "TestThing",
      initialState: {
        owner: "A_child2",
      },
    }),
  ];

  it("CREATED has correct partition and id.partitionURI for top-level partition children", () => {
    const harness = createRAEMTestHarness({ debug: 0 }, createBlockA);
    const grandparent = harness.run(vRef("A_grandparent"), null);
    const grandparentPartitionURI = harness.run(grandparent, "id").partitionURI();

    expect(grandparentPartitionURI)
        .toEqual(createLocalPartitionURIFromRawId("A_grandparent"));
    expect(harness.run(grandparent, "partitionAuthorityURI"))
        .toEqual("valaa-local:");
    expect(harness.run(grandparent, "partition"))
        .toBe(grandparent);

    expect(harness.run(vRef("A_parent"), "id").partitionURI())
        .toBe(grandparentPartitionURI);
    expect(harness.run(vRef("A_parent"), "partition"))
        .toBe(grandparent);

    expect(harness.run(vRef("A_child1"), "id").partitionURI())
        .toBe(grandparentPartitionURI);
    expect(harness.run(vRef("A_child1"), "partition"))
        .toBe(grandparent);
  });

  it("CREATED has correct partition and id.partitionURI for non-top-level partition", () => {
    const harness = createRAEMTestHarness({ debug: 0 }, createBlockA);
    const child2 = harness.run(vRef("A_child2"), null);
    const child2PartitionURI = harness.run(child2, "id").partitionURI();

    expect(child2PartitionURI)
        .toEqual(createMemoryPartitionURIFromRawId("A_child2"));
    expect(harness.run(child2, "partitionAuthorityURI"))
        .toEqual("valaa-memory:");
    expect(harness.run(child2, "partition"))
        .toBe(child2);

    expect(harness.run(vRef("A_grandchild"), "id").partitionURI())
        .toBe(child2PartitionURI);
    expect(harness.run(vRef("A_grandchild"), "partition"))
        .toBe(child2);

    expect(harness.run(vRef("A_grandownee"), "id").partitionURI())
        .toBe(child2PartitionURI);
    expect(harness.run(vRef("A_grandownee"), "partition"))
        .toBe(child2);
  });

  it("meshes partition infos properly when setting cross-partition dependency", () => {
    const harness = createRAEMTestHarness({ debug: 0 }, createBlockA);
    const story = harness.dispatch(transacted({
      actions: [
        created({ id: "B_testRoot", typeName: "TestThing",
          initialState: {
            partitionAuthorityURI: testAuthorityURI,
          },
        }),
        addedToFields({ id: "A_grandparent", typeName: "TestThing" }, {
          siblings: [vRef("B_testRoot")],
        }),
      ],
    }));
    const A_grandparent = { // eslint-disable-line
      eventId: null,
      partitionAuthorityURI: "valaa-local:",
    };
    const B_testRoot = { // eslint-disable-line
      eventId: null,
      partitionAuthorityURI: testAuthorityURI,
    };
    expect(story.partitions)
        .toEqual({ A_grandparent, B_testRoot });
    expect(story.actions[0].partitions)
        .toEqual({ B_testRoot });
    expect(story.actions[1].partitions)
        .toEqual({ A_grandparent, B_testRoot });


    const aGrandParent = harness.run(vRef("A_grandparent"), null);
    const bTestRoot = harness.run(vRef("B_testRoot"), null);
    expect(aGrandParent.partitionRawId())
        .toEqual("A_grandparent");
    expect(bTestRoot.partitionRawId())
        .toEqual("B_testRoot");

    expect(harness.run(vRef("A_grandparent"), ["§->", "siblings", 0]))
        .toBe(bTestRoot);
    expect(harness.run(vRef("B_testRoot"), ["§->", "siblings", 0]))
        .toBe(aGrandParent);
  });
});
