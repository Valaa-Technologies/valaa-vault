// @flow

import VALK, { run as unwrappedRun } from "~/raem/VALK";
import { created, fieldsSet } from "~/raem/events";
import { vRef } from "~/raem/VRL";
import { createRAEMTestHarness } from "~/raem/test/RAEMTestHarness";
import RAEMTestAPI from "~/raem/test/RAEMTestAPI";

function run (head, kuery, options = {}, ...rest) {
  options.schema = RAEMTestAPI.schema;
  return unwrappedRun(head, kuery, options, ...rest);
}

describe("VALK basic functionality tests", () => {
  it("Executes VALK.array example kueries with freeKuery", () => {
    const head = { dummy: true };
    expect(VALK.array("1", "2").toVAKON())
        .toEqual(["1", "2"]);
    expect(run(head, VALK.array("1", "2")))
        .toEqual(["1", "2"]);

    expect(VALK.fromValue("3").array().toVAKON())
        .toEqual(["§[]", "3"]);
    expect(run(head, VALK.fromValue("3").array()))
        .toEqual(["3"]);

    expect(VALK.fromValue("4").to(VALK.array()).toVAKON())
        .toEqual(["§->", ["§'", "4"], []]);
    expect(run(head, VALK.fromValue("4").to(VALK.array())))
        .toEqual([]);
  });

  it("Copies steps as per immutable rules", () => {
    const base = VALK.fromValue("1");
    expect(base.to("originalFollowUpStep").toVAKON())
        .toEqual(["§->", ["§'", "1"], "originalFollowUpStep"]);
    expect(base.to("branchFollowUpStep").toVAKON())
        .toEqual(["§->", ["§'", "1"], "branchFollowUpStep"]);
  });

  it("Resolves selection with head to null VAKON", () => {
    expect(VALK.object({ value: VALK.head() }).toVAKON())
        .toEqual({ value: ["§->", null] });
  });
});

describe("VPath to concrete VAKON valks", () => {
  const testContext = {
    random: {
      steps: ["§!random"],
    },
    valk: {
      stepsFor: {
        invoke: ["§invoke"],
        ref: ["§ref"],
        new: ["§new"],
        const: ["§$<-"],
        nullable: false,
      }
    }
  };

  it("Cements simple VPaths into VAKON", () => {
    expect(VALK.fromVPath("@!$.scriptRoot@!$random@@", { context: testContext }).toVAKON())
        .toEqual(["§->", ["§$", "scriptRoot"], ["§!random"]]);
    expect(VALK.fromVPath("@!invoke$.create$.@!$.body$.%24V$.target$.name@@@@").toVAKON())
        .toEqual([
          "§invoke", ["§'", "create"],
          ["§->", ["§$", "body"], ["§..", "$V"], ["§..", "target"], ["§..", "name"]],
        ]);
  });
  it("Rejects VPaths context terms which are undefined by the context", () => {
    expect(() => VALK.fromVPath("@!$.scriptRoot@!$thisIsBad@@", { context: testContext })
            .toVAKON())
        .toThrow(/unrecognized context term 'thisIsBad'/);
  });
  it("Cements complex VPaths into VAKON", () => {
    expect(VALK.fromVPath(
            "@!invoke$.create$.event$.@!$.source@@$.@!$.body@.$.%24V@.$.target@.$.name@@@@")
        .toVAKON())
    .toEqual([
      "§invoke", ["§'", "create"], ["§'", "event"],
      ["§$", "source"],
      ["§->", ["§$", "body"], ["§..", "$V"], ["§..", "target"], ["§..", "name"]],
    ]);
    expect(VALK.fromVPath(["@@", [
      ["@!$valk.const:newResource", ["@!$valk.new", [["@!:Entity"], {
        name: ["@!:request:body", "$V", "target", "name"],
        owner: ["@!:routeRoot"],
        properties: { name: ["@!:request:body", "$V", "target", "name"] },
      }]]],
      ["@!$valk.new", [["@!:Relation"], {
        name: ["@!:listingName"], source: ["@!:routeRoot"], target: ["@!:newResource"],
      }]],
      ["@!$valk.new", [["@!:Relation"], {
        name: ["@!:relationName"], source: ["@!:resource"], target: ["@!:newResource"],
      }]],
    ]], { context: testContext }).toVAKON())
    .toEqual(["§->",
      ["§$<-", "newResource",
        ["§new", ["§$", "Entity"],
          ["§{}",
            ["name", ["§->",
              ["§$", "request"], ["§..", "body"], ["§..", "$V"], ["§..", "target"], ["§..", "name"],
            ]],
            ["owner", ["§$", "routeRoot"]],
            ["properties", ["§{}",
              ["name", ["§->", ["§$", "request"],
                ["§..", "body"], ["§..", "$V"], ["§..", "target"], ["§..", "name"],
              ]],
            ]],
          ],
        ],
      ],
      ["§new", ["§$", "Relation"],
        ["§{}",
          ["name", ["§$", "listingName"]],
          ["source", ["§$", "routeRoot"]],
          ["target", ["§$", "newResource"]]],
      ],
      ["§new", ["§$", "Relation"],
        ["§{}",
          ["name", ["§$", "relationName"]],
          ["source", ["§$", "resource"]],
          ["target", ["§$", "newResource"]],
        ]
      ]
    ]);
  });
  it("Cements VPath outlines into VAKON while escaping nested vpaths", () => {
    expect(VALK.fromVPath(["@@", ["@$.", "constant"]])
        .toVAKON())
    .toEqual(["§'", "constant"]);
    expect(VALK.fromVPath([{ val: "constant", val2: 10 }])
        .toVAKON())
    .toEqual(["§{}", ["val", "constant"], ["val2", 10]]);
    expect(VALK.fromVPath([{ val: ["@$", "@"] }])
        .toVAKON())
    .toEqual(["§{}", ["val", "@"]]);
    expect(VALK.fromVPath([{ val: "@", val3: [1, 2, 3], val2: null }])
        .toVAKON())
    .toEqual(["§{}",
        ["val", "@"],
        ["val2", ["§'", null]],
        ["val3", ["§[]", ["§'", 1], ["§'", 2], ["§'", 3]]]]);
    expect(VALK.fromVPath(["@!:request:cookies", ["@!:identity:clientCookieName"]])
        .toVAKON())
    .toEqual(["§->",
      ["§$", "request"],
      ["§..", "cookies"],
      ["§..", ["§->", ["§$", "identity"], ["§..", "clientCookieName"]]],
    ]);
  });
  it("Cements complex embedded VPaths into VAKON", () => {
    expect(VALK.fromVPath([
      "@!invoke$.create$.event", ["@!$.source"],
        ["@!$.body@.$.%24V@", ["@.$.target"], ["@.$.name"]],
    ]).toVAKON())
    .toEqual([
      "§invoke", ["§'", "create"], ["§'", "event"], ["§$", "source"],
      ["§->", ["§$", "body"], ["§..", "$V"], ["§..", "target"], ["§..", "name"]],
    ]);
  });
});

const createBlockA = [
  created({ id: ["A_grandparent"], typeName: "TestThing" }),
  created({ id: ["A_parent"], typeName: "TestThing",
    initialState: { name: "parent", owner: vRef("A_grandparent", "children") },
  }),
  created({ id: ["A_child1"], typeName: "TestThing",
    initialState: { name: "child1", owner: vRef("A_parent", "children") },
  }),
  created({ id: ["A_parentGlue"], typeName: "TestGlue", initialState: {
    source: ["A_parent"], target: ["A_grandparent"], position: { x: 10, y: 1, z: null },
  } }),
];

const createBlockARest = [
  created({ id: ["A_child2"], typeName: "TestThing",
    initialState: { name: "child2", owner: vRef("A_parent", "children") },
  }),
  created({ id: ["A_childGlue"], typeName: "TestGlue", initialState: {
    source: ["A_child1"], target: ["A_child2"], position: { x: 10, y: 1, z: null },
  } }),
  created({ id: ["A_childDataGlue"], typeName: "TestDataGlue", initialState: {
    source: ["A_child1"], target: ["A_child2"],
  } }),
  fieldsSet({ id: ["A_child1"], typeName: "TestThing",
    sets: { targetDataGlues: ["A_childDataGlue"], },
  }),
  fieldsSet({ id: ["A_child2"], typeName: "TestThing",
    sets: { sourceDataGlues: ["A_childDataGlue"], },
  }),
];

describe("VALK corpus kueries", () => {
  it("Converts trivial VALK to into VAKON", () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createBlockA, createBlockARest);
    const kuery = VALK.to("children");
    expect(kuery.toVAKON()).toEqual(["§->", "children"]);
    expect(harness.run(vRef("A_parent"), kuery.map("rawId")))
        .toEqual(["@$~raw.A_child1@@", "@$~raw.A_child2@@"]);
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
    expect(harness.run(vRef("A_parentGlue"), kuery, { verbosity: 0 }))
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
    expect(kuery.toVAKON())
        .toEqual(["§==", ["§->", "id"], ["§vrl", ["@$~raw.A_parentGlue@@"]]]);
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
        .toEqual("@$~raw.A_parent@@");
  });

  it("Converts basic VALK.if into VAKON", () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createBlockA, createBlockARest);
    const kuery = VALK.if(VALK.to("id").looseEqualTo(vRef("A_child1")));
    expect(kuery.toVAKON())
        .toEqual(["§?", ["§==", ["§->", "id"], ["§vrl", ["@$~raw.A_child1@@"]]], null]);
    expect(harness.run(vRef("A_child1"), "rawId"))
        .toEqual("@$~raw.A_child1@@");
    expect(harness.run(vRef("A_child2"), kuery))
        .toEqual(undefined);
  });

  it("Converts trivial VALK.map into VAKON", () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createBlockA, createBlockARest);
    const kuery = VALK.map("rawId");
    expect(kuery.toVAKON()).toEqual(["§map", "rawId"]);
    expect(harness.run(vRef("A_parent"), VALK.to("children").toKuery(kuery)))
        .toEqual(["@$~raw.A_child1@@", "@$~raw.A_child2@@"]);
  });

  it("Converts basic VALK.map into VAKON", () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createBlockA, createBlockARest);
    const kuery = VALK.to("children").map("rawId");
    expect(kuery.toVAKON()).toEqual(["§->", "children", ["§map", "rawId"]]);
    expect(harness.run(vRef("A_parent"), kuery))
        .toEqual(["@$~raw.A_child1@@", "@$~raw.A_child2@@"]);
  });

  it("Converts VALK.map + VALK.if into VAKON", () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createBlockA, createBlockARest);
    const kuery = VALK.to("children").map(VALK.if(VALK.fromValue(true)));
    expect(kuery.toVAKON()).toEqual(["§->", "children", ["§map", ["§?", true, null]]]);
    expect(harness.run(vRef("A_parent"), kuery.map("rawId")))
        .toEqual(["@$~raw.A_child1@@", "@$~raw.A_child2@@"]);
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
            ["§filter", ["§==", ["§->", "id"], ["§vrl", ["@$~raw.A_child1@@"]]]]]);
    expect(harness.run(vRef("A_parent"), kuery.toIndex(0).to("rawId")))
        .toEqual("@$~raw.A_child1@@");
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
        .toEqual("@$~raw.A_grandparent@@");
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
        .toEqual("@$~raw.A_grandparent@@");
  });

  it("Accepts notNull with error message properly on valid paths", () => {
    const harness = createRAEMTestHarness({ verbosity: 0 }, createBlockA, createBlockARest);
    const kuery = VALK.to("parent").notNull("this should never be seen").to("parent");
    expect(harness.run(vRef("A_child1"), kuery.to("rawId")))
        .toEqual("@$~raw.A_grandparent@@");
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
  it("constructs an object", () => {
    expect(run({ aKey: "a" }, { null: null, aKeyName: "aKey", aKeyValue: ["§->", "aKey"] },
            { verbosity: 0, scope: { Array } }))
        .toEqual({ null: null, aKeyName: "aKey", aKeyValue: "a" });
  });
});
