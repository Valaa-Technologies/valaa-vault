import VALK, { run } from "~/raem/VALK";
import { created, fieldsSet } from "~/raem/events";
import { vRef } from "~/raem/ValaaReference";
import { createRAEMTestHarness } from "~/raem/test/RAEMTestHarness";

describe("VALK basic functionality tests", () => {
  it("Executes VALK.array example kueries with freeKuery", () => {
    const head = { dummy: true };
    expect(VALK.array("1", "2").toVAKON())
        .toEqual(["§[]", "1", "2"]);
    expect(run(head, VALK.array("1", "2")))
        .toEqual(["1", "2"]);

    expect(VALK.fromValue("3").array().toVAKON())
        .toEqual(["§[]", "3"]);
    expect(run(head, VALK.fromValue("3").array()))
        .toEqual(["3"]);

    expect(VALK.fromValue("4").to(VALK.array()).toVAKON())
        .toEqual([["§'", "4"], ["§[]"]]);
    expect(run(head, VALK.fromValue("4").to(VALK.array())))
        .toEqual([]);
  });

  it("Copies steps as per immutable rules", () => {
    const base = VALK.fromValue("1");
    expect(base.to("originalFollowUpStep").toVAKON())
        .toEqual([["§'", "1"], "originalFollowUpStep"]);
    expect(base.to("branchFollowUpStep").toVAKON())
        .toEqual([["§'", "1"], "branchFollowUpStep"]);
  });

  it("Resolves selection with head to null VAKON", () => {
    expect(VALK.select({ value: VALK.head() }).toVAKON())
        .toEqual({ value: null });
  });
});

const createBlockA = [
  created({ id: "A_grandparent", typeName: "TestThing" }),
  created({ id: "A_parent", typeName: "TestThing",
    initialState: { name: "parent", owner: vRef("A_grandparent", "children") },
  }),
  created({ id: "A_child1", typeName: "TestThing",
    initialState: { name: "child1", owner: vRef("A_parent", "children") },
  }),
  created({ id: "A_parentGlue", typeName: "TestGlue", initialState: {
    source: "A_parent", target: "A_grandparent", position: { x: 10, y: 1, z: null },
  } }),
];

const createBlockARest = [
  created({ id: "A_child2", typeName: "TestThing",
    initialState: { name: "child2", owner: vRef("A_parent", "children") },
  }),
  created({ id: "A_childGlue", typeName: "TestGlue", initialState: {
    source: "A_child1", target: "A_child2", position: { x: 10, y: 1, z: null },
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

describe("VALK corpus kueries", () => {
  it("Converts trivial VALK to into VAKON", () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createBlockA, createBlockARest);
    const kuery = VALK.to("children");
    expect(kuery.toVAKON()).toEqual("children");
    expect(harness.run(vRef("A_parent"), kuery.map("rawId")))
        .toEqual(["A_child1", "A_child2"]);
  });

  it("Converts VALK to-to into VAKON", () => {
    const kuery = VALK.to("source").to("children");
    expect(kuery.toVAKON()).toEqual(["§->", "source", "children"]);
  });

  it("Converts basic VALK to-to-map-to into VAKON", () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createBlockA, createBlockARest);
    const kuery = VALK.to("source").to("children").map("name");
    expect(kuery.toVAKON())
        .toEqual(["§->", "source", "children", ["§map", "name"]]);
    expect(harness.run(vRef("A_parentGlue"), kuery))
        .toEqual(["child1", "child2"]);
  });

  it("Converts trivial VALK.equalTo into VAKON", () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createBlockA, createBlockARest);
    const kuery = VALK.equalTo(10);
    expect(kuery.toVAKON()).toEqual(["§===", null, 10]);
    expect(harness.run(vRef("A_parentGlue"),
            VALK.to("position").to("x").toKuery(kuery)))
        .toEqual(true);
  });

  it("Converts basic VALK.equalTo into VAKON", () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createBlockA, createBlockARest);
    const kuery = VALK.to("id").looseEqualTo(vRef("A_parentGlue"));
    expect(kuery.toVAKON()).toEqual(["§==", ["id"], ["§VRef", ["A_parentGlue"]]]);
    expect(harness.run(vRef("A_parentGlue"), kuery))
        .toEqual(true);
    expect(harness.run(vRef("A_childGlue"), kuery))
        .toEqual(false);
  });

  it("Converts trivial VALK.if into VAKON", () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createBlockA, createBlockARest);
    const kuery = VALK.if(VALK.fromValue(true));
    expect(kuery.toVAKON()).toEqual(["§?", true, null]);
    expect(harness.run(vRef("A_parent"), "rawId"))
        .toEqual("A_parent");
  });

  it("Converts basic VALK.if into VAKON", () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createBlockA, createBlockARest);
    const kuery = VALK.if(VALK.to("id").looseEqualTo(vRef("A_child1")));
    expect(kuery.toVAKON())
        .toEqual(["§?", ["§==", ["id"], ["§VRef", ["A_child1"]]], null]);
    expect(harness.run(vRef("A_child1"), "rawId"))
        .toEqual("A_child1");
    expect(harness.run(vRef("A_child2"), kuery))
        .toEqual(undefined);
  });

  it("Converts trivial VALK.map into VAKON", () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createBlockA, createBlockARest);
    const kuery = VALK.map("rawId");
    expect(kuery.toVAKON()).toEqual(["§map", "rawId"]);
    expect(harness.run(vRef("A_parent"), VALK.to("children").toKuery(kuery)))
        .toEqual(["A_child1", "A_child2"]);
  });

  it("Converts basic VALK.map into VAKON", () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createBlockA, createBlockARest);
    const kuery = VALK.to("children").map("rawId");
    expect(kuery.toVAKON()).toEqual(["§->", "children", ["§map", "rawId"]]);
    expect(harness.run(vRef("A_parent"), kuery))
        .toEqual(["A_child1", "A_child2"]);
  });

  it("Converts VALK.map + VALK.if into VAKON", () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createBlockA, createBlockARest);
    const kuery = VALK.to("children").map(VALK.if(VALK.fromValue(true)));
    expect(kuery.toVAKON()).toEqual(["§->", "children", ["§map", ["§?", true, null]]]);
    expect(harness.run(vRef("A_parent"), kuery.map("rawId")))
        .toEqual(["A_child1", "A_child2"]);
  });

  it("Converts trivial VALK.filter into VAKON", () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createBlockA, createBlockARest);
    const kuery = VALK.to("children").filter(VALK.fromValue(false));
    expect(kuery.toVAKON())
        .toEqual(["§->", "children", ["§filter", ["§'", false]]]);
    expect(harness.run(vRef("A_parent"), kuery))
        .toEqual([]);
  });

  it("Converts VALK.filter into VAKON", () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createBlockA, createBlockARest);
    const kuery = VALK.to("children").filter(VALK.to("id").looseEqualTo(vRef("A_child1")));
    expect(kuery.toVAKON())
        .toEqual(["§->", "children",
            ["§filter", ["§==", ["id"], ["§VRef", ["A_child1"]]]]]);
    expect(harness.run(vRef("A_parent"), kuery.toIndex(0).to("rawId")))
        .toEqual("A_child1");
  });
});

describe("VALK.nullable and VALK.nonNull - VAKON false and true", () => {
  it("Throws when stepping forward from null step head", () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createBlockA, createBlockARest);
    const kuery = VALK.to("parent").to("parent");
    expect(() => harness.run(vRef("A_grandparent"), kuery))
        .toThrow();
  });

  it("Short-circuits path properly with nullable on null step head", () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createBlockA, createBlockARest);
    const kuery = VALK.to("parent").nullable().to("parent");
    expect(harness.run(vRef("A_grandparent"), kuery))
        .toEqual(undefined);
  });

  it("Accepts nullable as an identity step on valid paths", () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createBlockA, createBlockARest);
    const kuery = VALK.to("parent").nullable().to("parent");
    expect(harness.run(vRef("A_child1"), kuery.to("rawId")))
        .toEqual("A_grandparent");
  });

  it("Throws if last step of a path is null", () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createBlockA, createBlockARest);
    const kuery = VALK.to("parent").notNull();
    expect(() => harness.run(vRef("A_grandparent"), kuery))
        .toThrow();
  });

  it("Accepts notNull as an identity step on valid paths", () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createBlockA, createBlockARest);
    const kuery = VALK.to("parent").notNull().to("parent");
    expect(harness.run(vRef("A_child1"), kuery.to("rawId")))
        .toEqual("A_grandparent");
  });

  it("Accepts notNull with error message properly on valid paths", () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createBlockA, createBlockARest);
    const kuery = VALK.to("parent").notNull("this should never be seen").to("parent");
    expect(harness.run(vRef("A_child1"), kuery.to("rawId")))
        .toEqual("A_grandparent");
  });

  it("Throws with notNull containing an error message and an empty head", () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createBlockA, createBlockARest);
    const kuery = VALK.to("parent").notNull("this should be seen in the log");
    expect(() => harness.run(vRef("A_grandparent"), kuery))
        .toThrow();
  });
});

describe("VALK expressions", () => {
  it("runs VALK.isTruthy to true with truthy head", () => {
    expect(run(true, VALK.isTruthy()))
        .toEqual(true);
    expect(run("truthy", VALK.isTruthy()))
        .toEqual(true);
    expect(run(1, VALK.isTruthy()))
        .toEqual(true);
    expect(run({}, VALK.isTruthy()))
        .toEqual(true);
    expect(run({ field: "truthy" }, VALK.isTruthy(VALK.to("field"))))
        .toEqual(true);
    expect(run({ field: "truthy" }, VALK.to("field").toKuery(VALK.isTruthy())))
        .toEqual(true);
  });
  it("runs VALK.isTruthy to false with falsy head", () => {
    expect(run(false, VALK.isTruthy()))
        .toEqual(false);
    expect(run("", VALK.isTruthy()))
        .toEqual(false);
    expect(run(0, VALK.isTruthy()))
        .toEqual(false);
    expect(run(null, VALK.isTruthy()))
        .toEqual(false);
    expect(run({ field: null }, VALK.isTruthy(VALK.to("field"))))
        .toEqual(false);
    expect(run({ field: 0 }, VALK.to("field").toKuery(VALK.isTruthy())))
        .toEqual(false);
  });
  it("runs VALK.isFalsy to false with truthy head", () => {
    expect(run(true, VALK.isFalsy()))
        .toEqual(false);
    expect(run("truthy", VALK.isFalsy()))
        .toEqual(false);
    expect(run(1, VALK.isFalsy()))
        .toEqual(false);
    expect(run({}, VALK.isFalsy()))
        .toEqual(false);
    expect(run({ field: "truthy" }, VALK.isFalsy(VALK.to("field"))))
        .toEqual(false);
    expect(run({ field: "truthy" }, VALK.to("field").toKuery(VALK.isFalsy())))
        .toEqual(false);
  });
  it("runs VALK.isFalsy to true with falsy head", () => {
    expect(run(false, VALK.isFalsy()))
        .toEqual(true);
    expect(run("", VALK.isFalsy()))
        .toEqual(true);
    expect(run(0, VALK.isFalsy()))
        .toEqual(true);
    expect(run(null, VALK.isFalsy()))
        .toEqual(true);
    expect(run({ field: null }, VALK.isFalsy(VALK.to("field"))))
        .toEqual(true);
    expect(run({ field: 0 }, VALK.to("field").toKuery(VALK.isFalsy())))
        .toEqual(true);
  });
  it("returns correct values for simple typeof calls", () => {
    expect(run(undefined, VALK.typeof()))
        .toEqual("undefined");
    expect(run(undefined, VALK.typeofEqualTo("undefined")))
        .toBe(true);
    expect(run(null, VALK.typeof()))
        .toEqual("object");
    expect(run({ dummy: 0 }, VALK.typeof()))
        .toEqual("object");
    expect(run(0, VALK.typeof()))
        .toEqual("number");
    expect(run(1.0, VALK.typeof()))
        .toEqual("number");
    expect(run("foo", VALK.typeof()))
        .toEqual("string");
  });
});

describe("VALK.to", () => {
  it("constructs an Array from literals", () => {
    expect(run(null, VALK.to(["a", "b"]), { scope: { Array } }))
        .toEqual(["a", "b"]);
  });
  it("constructs an Array by lookups", () => {
    expect(run({ aKey: "a", bKey: "b" }, VALK.to([VALK.to("aKey"), VALK.to("bKey")]),
        { scope: { Array } })).toEqual(["a", "b"]);
  });
});
