// @flow
import { created, addedTo, transacted } from "~/raem/events";
import { vRef } from "~/raem/VRL";

import { createRAEMTestHarness } from "~/raem/test/RAEMTestHarness";
import { createLocalChronicleURIFromRootId, createMemoryChronicleURIFromRootId }
    from "~/raem/ValaaURI";

const testAuthorityURI = "valaa-test:";
// const sharedURI = "valos-shared-content";

describe("chronicles", () => {
  beforeEach(() => {});

  const createBlockA = [
    // LocalChronicle is implicitly created
    created({ id: ["@$~raw:A_grandparent@@"], typeName: "TestThing",
      initialState: {
        authorityURI: "valaa-local:"
      },
    }),
    created({ id: ["A_parent"], typeName: "TestThing",
      initialState: { owner: vRef("@$~raw:A_grandparent@@", "children") },
    }),
    created({ id: ["A_child1"], typeName: "TestThing",
      initialState: { owner: vRef("@$~raw:A_parent@@", "children") },
    }),
    created({ id: ["A_child2"], typeName: "TestThing",
      initialState: {
        owner: vRef("A_parent", "children"),
        authorityURI: "valaa-memory:",
      },
    }),
    created({ id: ["A_grandchild"], typeName: "TestThing",
      initialState: {
        owner: vRef("A_child2", "children"),
      },
    }),
    created({ id: ["A_grandownee"], typeName: "TestThing",
      initialState: {
        owner: ["A_child2"],
      },
    }),
  ];

  it("CREATED has correct chronicle and id.getChronicleURI() for top-level children", () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createBlockA);
    const grandparent = harness.run(vRef("@$~raw:A_grandparent@@"), null);
    const grandparentChronicleURI = harness.run(grandparent, "id").getChronicleURI();

    expect(grandparentChronicleURI)
        .toEqual(createLocalChronicleURIFromRootId("@$~raw:A_grandparent@@"));
    expect(harness.run(grandparent, "authorityURI"))
        .toEqual("valaa-local:");
    expect(harness.run(grandparent, "partition"))
        .toBe(grandparent);

    expect(harness.run(vRef("A_parent"), "id").getChronicleURI())
        .toBe(grandparentChronicleURI);
    expect(harness.run(vRef("A_parent"), "partition"))
        .toBe(grandparent);

    expect(harness.run(vRef("A_child1"), "id").getChronicleURI())
        .toBe(grandparentChronicleURI);
    expect(harness.run(vRef("A_child1"), "partition"))
        .toBe(grandparent);
  });

  it("CREATED has correct chronicle and id.getChronicleURI() for non-top-level chronicle", () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createBlockA);
    const child2 = harness.run(vRef("A_child2"), null);
    const child2ChronicleURI = harness.run(child2, "id").getChronicleURI();

    expect(child2ChronicleURI)
        .toEqual(createMemoryChronicleURIFromRootId("@$~raw:A_child2@@"));
    expect(harness.run(child2, "authorityURI"))
        .toEqual("valaa-memory:");
    expect(harness.run(child2, "partition"))
        .toBe(child2);

    expect(harness.run(vRef("A_grandchild"), "id").getChronicleURI())
        .toBe(child2ChronicleURI);
    expect(harness.run(vRef("A_grandchild"), "partition"))
        .toBe(child2);

    expect(harness.run(vRef("A_grandownee"), "id").getChronicleURI())
        .toBe(child2ChronicleURI);
    expect(harness.run(vRef("A_grandownee"), "partition"))
        .toBe(child2);
  });

  it("meshes chronicle infos properly when setting cross-chronicle dependency", () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createBlockA);
    const finalEvent = harness.chronicleEvent(transacted({
      actions: [
        created({ id: ["B_testRoot"], typeName: "TestThing",
          initialState: {
            authorityURI: testAuthorityURI,
          },
        }),
        addedTo({ id: ["A_grandparent"], typeName: "TestThing",
          adds: { siblings: [vRef("B_testRoot")], },
        }),
      ],
    })).getTruthEvent();
    const aGrandparentChronicle = { // eslint-disable-line
      "valaa-local:?id=@$~raw:A_grandparent@@": {},
    };
    const bTestRootChronicle = { // eslint-disable-line
      "valaa-test:?id=@$~raw:B_testRoot@@": {},
    };
    expect(finalEvent.meta.chronicles)
        .toEqual({ ...aGrandparentChronicle, ...bTestRootChronicle });
    expect(finalEvent.meta.chronicleURI)
        .toEqual("valaa-test:?id=@$~raw:B_testRoot@@");
    expect((finalEvent.actions[0].meta || {}).chronicles)
        .toBeFalsy();
    expect((finalEvent.actions[0].meta || {}).chronicleURI)
        .toBeFalsy();
    expect(finalEvent.actions[1].meta.chronicles)
        .toEqual({ ...aGrandparentChronicle, ...bTestRootChronicle });


    const aGrandParent = harness.run(vRef("A_grandparent"), null);
    const bTestRoot = harness.run(vRef("B_testRoot"), null);
    expect(aGrandParent.getChronicleId())
        .toEqual("@$~raw:A_grandparent@@");
    expect(bTestRoot.getChronicleId())
        .toEqual("@$~raw:B_testRoot@@");

    expect(harness.run(vRef("A_grandparent"), ["§->", "siblings", 0]))
        .toBe(bTestRoot);
    expect(harness.run(vRef("B_testRoot"), ["§->", "siblings", 0]))
        .toBe(aGrandParent);
  });
});
