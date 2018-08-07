// @flow

import { created } from "~/raem/command/index";
import { vRef } from "~/raem/ValaaReference";
import { createGhostRawId } from "~/raem/tools/denormalized/GhostPath";

import VALEK from "~/engine/VALEK";
import Vrapper from "~/engine/Vrapper";

import { createEngineTestHarness } from "~/engine/test/EngineTestHarness";

const transactionA = {
  type: "TRANSACTED",
  actions: [
    created({ id: "test", typeName: "TestScriptyThing", initialState: {
      name: "testName",
    }, }),
    created({ id: "child", typeName: "TestScriptyThing", initialState: {
      parent: "test",
      name: "childName",
    }, }),
    created({ id: "ownling", typeName: "TestScriptyThing", initialState: {
      owner: "test",
      name: "ownlingName",
    }, }),
    created({ id: "grandChild", typeName: "TestScriptyThing", initialState: {
      parent: "child",
    }, }),
    created({ id: "grandSibling", typeName: "TestScriptyThing", initialState: {
      parent: "child",
    }, }),
    created({ id: "greatGrandChild", typeName: "TestScriptyThing", initialState: {
      parent: "grandChild",
    }, }),
    created({ id: "greatGrandChildOwnling", typeName: "TestScriptyThing", initialState: {
      owner: "greatGrandChild",
      name: "greatGrandChildOwnlingName",
    }, }),
  ]
};

const createAInstance
    = created({ id: "test#1", typeName: "TestScriptyThing", initialState: {
      instancePrototype: "test",
    }, });


describe("Vrapper", () => {
  let harness: { createds: Object, engine: Object, prophet: Object, testEntities: Object };
  const testScriptPartitions = () => harness.createds.TestScriptyThing;
  const entities = () => harness.createds.Entity;

  const expectNoVrapper = rawId => { expect(harness.engine.tryVrapper(rawId)).toBeFalsy(); };
  const expectVrapper = rawId => { expect(harness.engine.tryVrapper(rawId)).toBeTruthy(); };

  const touchField = (vrapper, field) => {
    const value = vrapper.get(field);
    vrapper.setField(field, `touched_${value}`);
  };

  const checkVrapperSets = (observedVrapper, { expectFields, targetId, sets, expectUpdates }) => {
    const notificationValues = {};
    for (const key of Object.keys(expectFields)) {
      expect(observedVrapper.get(key))
          .toEqual(expectFields[key]);
    }
    for (const key of Object.keys(sets || {})) {
      observedVrapper.subscribeToMODIFIED(key, (update) => {
        notificationValues[key] = update.value();
      });
    }
    harness.prophet.claim({ type: "FIELDS_SET", id: targetId,
      typeName: "TestScriptyThing",
      sets,
    });
    const actualexpectUpdates = expectUpdates || sets;
    for (const key of Object.keys(actualexpectUpdates || {})) {
      expect(notificationValues[key])
          .toEqual(actualexpectUpdates[key]);
    }
  };

  const getGhostVrapperById = (ghostPrototypeRawId, instanceRawId) =>
      harness.engine.getVrapper(createGhostRawId(ghostPrototypeRawId, instanceRawId));

  describe("Vrapper basic functionality", () => {
    it("returns vrappers for non-ghost when returned from kuery", () => {
      harness = createEngineTestHarness({ debug: 0, claimBaseBlock: false }, [
        transactionA, createAInstance,
      ]);
      expectVrapper("test");
      const vChild = testScriptPartitions().test.get(["§->", "children", 0]);
      expect(vChild instanceof Vrapper)
          .toEqual(true);
      expect(vChild)
          .toEqual(harness.engine.getVrapper("child"));
    });

    it("touches a Vrapper field and it is properly modified for subsequent reads", () => {
      harness = createEngineTestHarness({ debug: 0, claimBaseBlock: false }, [
        transactionA, createAInstance,
      ]);
      touchField(testScriptPartitions().test, "name");
      expect(testScriptPartitions().test.get("name"))
          .toEqual("touched_testName");
      expect(harness.engine.getVrapper("test").get("name"))
          .toEqual("touched_testName");
    });

    it("doesn't create Vrappers for ghosts by default", () => {
      harness = createEngineTestHarness({ debug: 0, claimBaseBlock: false }, [
        transactionA, createAInstance,
      ]);
      expectNoVrapper(createGhostRawId("child", "test#1"));
    });

    it("returns Vrappers for ghost when returned from kuery", () => {
      harness = createEngineTestHarness({ debug: 0, claimBaseBlock: false }, [
        transactionA, createAInstance,
      ]);
      const vChildGhost = testScriptPartitions()["test#1"].get(["§->", "children", 0]);
      expect(vChildGhost instanceof Vrapper)
          .toEqual(true);
      const expectedChildGhostRawId = createGhostRawId("child", "test#1");
      expect(vChildGhost.getRawId())
          .toEqual(expectedChildGhostRawId);
      expectVrapper(expectedChildGhostRawId);
    });

    it("returns a correct Vrapper with getGhostIn", () => {
      harness = createEngineTestHarness({ debug: 0, claimBaseBlock: false }, [
        transactionA, createAInstance,
      ]);
      const result = testScriptPartitions().child.getGhostIn(testScriptPartitions()["test#1"]);
      expect(result)
          .toEqual(getGhostVrapperById("child", "test#1"));
    });

    it("returns a correct Vrapper with kuery", () => {
      harness = createEngineTestHarness({ debug: 0, claimBaseBlock: false }, [
        transactionA, createAInstance,
      ]);
      const result = testScriptPartitions()["test#1"].get(["§->", "children", 0]);
      expect(result)
          .toEqual(getGhostVrapperById("child", "test#1"));
    });
  });

  describe("Vrapper media decoder integration", () => {
    let testVrapper;

    beforeEach(() => {
      harness = createEngineTestHarness({ debug: 0, claimBaseBlock: false }, [
        transactionA, createAInstance,
      ]);
      testVrapper = testScriptPartitions().child;
    });

    describe("_getMediaTypeFromTags", () => {
      it("should return a media type object for the first valid mediaType tag", () => {
        testVrapper.addToField("tags", { typeName: "Tag", tagURI: "invalidtaguri" });
        testVrapper.addToField("tags",
            { typeName: "Tag", tagURI: "tag:valaa.com,2017-07-21-date:validButNotMediaType" });
        testVrapper.addToField("tags", {
          typeName: "Tag",
          tagURI: "tag:valaa.com,2017-07-21-date:validButNotMediaType#second"
        });
        testVrapper.addToField("tags", {
          typeName: "Tag",
          tagURI: "tag:valaa.com,2017-07-21-date:mediaType#application/valaascript"
        });
        expect(testVrapper._getMediaTypeFromTags()).toEqual({
          type: "application",
          subtype: "valaascript"
        });
      });

      it("should return a null if there are no valid media type tags", () => {
        testVrapper.addToField("tags", { typeName: "Tag", tagURI: "invalidtaguri" });
        testVrapper.addToField("tags",
            { typeName: "Tag", tagURI: "tag:valaa.com,2017-07-21-date:validButNotMediaType" });
        testVrapper.addToField("tags", {
          typeName: "Tag",
          tagURI: "tag:valaa.com,2017-07-21-date:validButNotMediaType#second"
        });
        expect(testVrapper._getMediaTypeFromTags()).toEqual(null);
      });
    });

    describe("Media interpretation", () => {
      let mediaTypeUsed;
      const mockIntegrateDecoding = (decodedContent, vOwner, mediaType) => {
        mediaTypeUsed = mediaType;
        return decodedContent;
      };

      let testVrapperMediaInfo;
      beforeEach(() => {
        testVrapperMediaInfo = {
          name: "file.vs", type: "meta", subtype: "data",
        };
        testVrapper.engine._integrateDecoding = mockIntegrateDecoding;
        testVrapper.interpretContent = (() => "");
        testVrapper.hasInterface = () => true;
        testVrapper.get = function (kuery) {
          if (kuery === Vrapper.toMediaInfoFields) return ({ ...testVrapperMediaInfo });
          return Vrapper.prototype.get.call(this, kuery);
        };
      });

      it("should use appropriate media type based on the following rule order: " +
         "from options.mediaType > from media itself > from name extension", () => {
        testVrapper.addToField("tags", {
          typeName: "Tag",
          tagURI: "tag:valaa.com,2017-07-21-date:mediaType#application/javascript"
        });
        testVrapper._obtainMediaInterpretation({
          decodedContent: "", mediaInfo: { type: "application", subtype: "javascript" },
        }, testVrapper);
        expect(mediaTypeUsed.type).toEqual("application");
        expect(mediaTypeUsed.subtype).toEqual("javascript");

        testVrapper._obtainMediaInterpretation({ decodedContent: "", mime: "text/plain" },
            testVrapper);
        expect(mediaTypeUsed.type).toEqual("text");
        expect(mediaTypeUsed.subtype).toEqual("plain");

        testVrapper._obtainMediaInterpretation({ decodedContent: "" }, testVrapper);
        expect(mediaTypeUsed.type).toEqual("meta");
        expect(mediaTypeUsed.subtype).toEqual("data");
        testVrapper._obtainMediaInterpretation({ decodedContent: "", mimeFallback: "fall/back" },
            testVrapper);
        expect(mediaTypeUsed.type).toEqual("meta");
        expect(mediaTypeUsed.subtype).toEqual("data");

        testVrapperMediaInfo.type = "";
        testVrapperMediaInfo.subtype = "";
        testVrapper._obtainMediaInterpretation({ decodedContent: "" }, testVrapper);
        expect(mediaTypeUsed.type).toEqual("application");
        expect(mediaTypeUsed.subtype).toEqual("valaascript");
        testVrapper._obtainMediaInterpretation({ decodedContent: "", mimeFallback: "fall/back" },
            testVrapper);
        expect(mediaTypeUsed.type).toEqual("application");
        expect(mediaTypeUsed.subtype).toEqual("valaascript");

        testVrapperMediaInfo.name = "file";
        testVrapper._obtainMediaInterpretation({ decodedContent: "" }, testVrapper);
        expect(mediaTypeUsed.type).toEqual("application");
        expect(mediaTypeUsed.subtype).toEqual("octet-stream");
        testVrapper._obtainMediaInterpretation({ decodedContent: "", mimeFallback: "fall/back" },
            testVrapper);
        expect(mediaTypeUsed.type).toEqual("fall");
        expect(mediaTypeUsed.subtype).toEqual("back");
      });
    });
  });

  describe("Vrapper MODIFIED notifications", () => {
    it("notifies on field change when modified directly", () => {
      harness = createEngineTestHarness({ debug: 0, claimBaseBlock: false }, [
        transactionA, createAInstance,
      ]);
      checkVrapperSets(testScriptPartitions().test, {
        expectFields: { name: "testName" },
        targetId: "test",
        sets: { name: "harambe" },
        expectUpdates: { name: "harambe" },
      });
    });

    it("notifies on untouched instance field change when modified through prototype", () => {
      harness = createEngineTestHarness({ debug: 0, claimBaseBlock: false }, [
        transactionA, createAInstance,
      ]);
      checkVrapperSets(testScriptPartitions()["test#1"], {
        expectFields: { name: "testName" },
        targetId: "test",
        sets: { name: "harambe" },
        expectUpdates: { name: "harambe" },
      });
    });

    /* Currently always notifying: would need additional logic to filter these out.
     * One possibility is to just compare the values: it might make sense to eliminate notifications
     * on events which change nothing.
    it("does not notify on touched instance field change when modified through prototype", () => {
      harness = createEngineTestHarness({ debug: 0, claimBaseBlock: false }, [
        transactionA, createAInstance,
      ]);
      touchField(testScriptPartitions["test#1"], "name");
      checkVrapperSets(testScriptPartitions["test#1"], {
        expectFields: { name: "touched_testName" },
        targetId: "test",
        sets: { name: "harambe" },
        expectUpdates: { name: undefined }, // undefined means 'no update seen'
      });
    });
    */

    it("notifies on immaterial ghost field change when modified through ghost prototype", () => {
      harness = createEngineTestHarness({ debug: 0, claimBaseBlock: false }, [
        transactionA, createAInstance,
      ]);
      const vChildGhost = testScriptPartitions().child.getGhostIn(testScriptPartitions()["test#1"]);
      expect(vChildGhost.isMaterialized())
          .toEqual(false);
      checkVrapperSets(vChildGhost, {
        expectFields: { name: "childName" },
        targetId: "child",
        sets: { name: "harambe" },
        expectUpdates: { name: "harambe" },
      });
    });

    it("notifies on material ghost untouched field change when modified through ghost prototype",
    () => {
      harness = createEngineTestHarness({ debug: 0, claimBaseBlock: false }, [
        transactionA, createAInstance,
      ]);
      const vChildGhost = testScriptPartitions().child.getGhostIn(testScriptPartitions()["test#1"]);
      vChildGhost.materialize();
      expect(vChildGhost.isMaterialized())
          .toEqual(true);
      checkVrapperSets(vChildGhost, {
        expectFields: { name: "childName" },
        targetId: "child",
        sets: { name: "harambe" },
        expectUpdates: { name: "harambe" },
      });
    });

    it("notifies on immaterial ghost field change when modified directly", () => {
      harness = createEngineTestHarness({ debug: 0, claimBaseBlock: false }, [
        transactionA, createAInstance,
      ]);
      const vChildGhost = testScriptPartitions().child.getGhostIn(testScriptPartitions()["test#1"]);
      expect(vChildGhost.isMaterialized())
          .toEqual(false);
      checkVrapperSets(vChildGhost, {
        expectFields: { name: "childName" },
        targetId: vChildGhost.getId(),
        sets: { name: "harambe" },
        expectUpdates: { name: "harambe" },
      });
      expect(vChildGhost.isMaterialized())
          .toEqual(true);
    });

    it("notifies subscribers to the owner list when a child object is DESTROYED", () => {
      harness = createEngineTestHarness({ debug: 0, claimBaseBlock: false }, [
        transactionA, createAInstance,
      ]);
      let modCalled = false;
      testScriptPartitions().child.subscribeToMODIFIED("children", () => {
        modCalled = true;
      });
      harness.prophet.claim(
          { type: "DESTROYED", id: "grandChild", typeName: "TestScriptyThing" });
      // children modified subscriber should have been called when the sub-command to remove
      // grandChild from the children list was reduced
      expect(modCalled).toEqual(true);
    });

    it("notifies subscribers to the owner list when a child object is reparented", () => {
      harness = createEngineTestHarness({ debug: 0, claimBaseBlock: false }, [
        transactionA, createAInstance,
      ]);
      let modCalled = false;
      testScriptPartitions().grandChild.subscribeToMODIFIED("children", () => {
        modCalled = true;
      });
      testScriptPartitions().greatGrandChild.setField("parent",
          testScriptPartitions().grandSibling);

      // children modified subscriber should have been called when the sub-command to remove
      // grandChild from the children list was reduced
      expect(modCalled).toEqual(true);
    });
  });

  const checkVrapperDestroy = (observedVrapper, { destroyVrapper = observedVrapper } = {}) => {
    let count = 0;
    const observedRawId = observedVrapper.getRawId();
    observedVrapper.addDESTROYEDHandler(() => {
      ++count;
    });
    destroyVrapper.destroy();
    expect(count)
        .toEqual(1);
    expect(harness.engine.tryVrapper(observedRawId))
        .toBeFalsy();
  };

  describe("Vrapper DESTROYED notifications", () => {
    it("calls destroy subscribers when the object is destroyed", () => {
      harness = createEngineTestHarness({ debug: 0, claimBaseBlock: false }, [transactionA]);
      checkVrapperDestroy(testScriptPartitions().test);
    });

    it("calls destroy subscribers when the instance is destroyed", () => {
      harness = createEngineTestHarness({ debug: 0, claimBaseBlock: false }, [
        transactionA, createAInstance,
      ]);
      checkVrapperDestroy(testScriptPartitions()["test#1"]);
    });

    it("calls destroy subscribers when the ghost is destroyed", () => {
      harness = createEngineTestHarness({ debug: 0, claimBaseBlock: false }, [
        transactionA, createAInstance,
      ]);
      checkVrapperDestroy(testScriptPartitions().child.getGhostIn(
          testScriptPartitions()["test#1"]));
    });

    it("calls destroy subscribers on an instance when its prototype is destroyed", () => {
      harness = createEngineTestHarness({ debug: 0, claimBaseBlock: false }, [
        transactionA, createAInstance,
      ]);
      expect(() => checkVrapperDestroy(testScriptPartitions()["test#1"],
              { destroyVrapper: testScriptPartitions().test }))
          .toThrow(/destruction blocked/);
    });

    it("calls destroy subscribers on a ghost when its ghost prototype is destroyed", () => {
      harness = createEngineTestHarness({ debug: 0, claimBaseBlock: false }, [
        transactionA, createAInstance,
      ]);
      checkVrapperDestroy(
          testScriptPartitions().child.getGhostIn(testScriptPartitions()["test#1"]),
          { destroyVrapper: testScriptPartitions().child });
    });
  });

  describe("Vrapper sub-event notifications", () => {
    it("calls the destroy subscriber for all children of a destroyed object", () => {
      harness = createEngineTestHarness({ debug: 0, claimBaseBlock: false }, [
        transactionA,
      ]);
      const counts = [];
      testScriptPartitions().test.addDESTROYEDHandler(() => { counts[0] = (counts[0] || 0) + 1; });
      testScriptPartitions().child.addDESTROYEDHandler(() => { counts[1] = (counts[1] || 0) + 1; });
      testScriptPartitions().grandChild.addDESTROYEDHandler(
          () => { counts[2] = (counts[2] || 0) + 1; });
      testScriptPartitions().test.destroy();
      expect(counts)
          .toEqual([1, 1, 1]);
    });

    it("calls the destroy subscriber for all ghosts of a destroyed object", () => {
      harness = createEngineTestHarness({ debug: 0, claimBaseBlock: false }, [
        transactionA, createAInstance,
      ]);
      const counts = [];
      const childGhost = testScriptPartitions().child.getGhostIn(testScriptPartitions()["test#1"]);
      childGhost.addDESTROYEDHandler(() => { counts[0] = (counts[0] || 0) + 1; });
      const grandChildGhost = testScriptPartitions().grandChild.getGhostIn(
          testScriptPartitions()["test#1"]);
      grandChildGhost.addDESTROYEDHandler(() => { counts[1] = (counts[1] || 0) + 1; });
      expect(harness.engine.tryVrapper("child"))
          .toBeTruthy();
      expect(harness.engine.tryVrapper("grandChild"))
          .toBeTruthy();
      testScriptPartitions().child.destroy();
      expect(counts)
          .toEqual([1, 1]);
      expect(harness.engine.tryVrapper(childGhost.getRawId()))
          .toBeFalsy();
      expect(harness.engine.tryVrapper(grandChildGhost.getRawId()))
          .toBeFalsy();
    });
  });

  describe("Ghost relations manipulations", () => {
    it("does not mutate ghost prototype list field when mutating immaterial ghost field", () => {
      harness = createEngineTestHarness({ debug: 0, claimBaseBlock: false }, [
        transactionA, createAInstance,
      ]);
      const childGhost = testScriptPartitions().child.getGhostIn(testScriptPartitions()["test#1"]);
      expect(testScriptPartitions().child.get("children").length)
          .toEqual(2);
      harness.engine.create("TestScriptyThing", { parent: childGhost, name: "guest" });
      expect(testScriptPartitions().child.get("children").length)
          .toEqual(2);
    });

    it("maintains list references on list field prototype->ghost upgrades", () => {
      harness = createEngineTestHarness({ debug: 0, claimBaseBlock: false }, [
        transactionA, createAInstance,
      ]);
      const childGhost = testScriptPartitions().child.getGhostIn(testScriptPartitions()["test#1"]);
      const grandChildGhost = testScriptPartitions().grandChild.getGhostIn(
          testScriptPartitions()["test#1"]);
      expect(childGhost.get(["§->", "children", 0]))
          .toEqual(grandChildGhost);
      const vGuest = harness.engine.create("TestScriptyThing",
          { parent: childGhost, name: "guest" });
      expect(vGuest.get("parent"))
          .toEqual(childGhost);
      const childGhostChildren = childGhost.get("children");
      expect(childGhostChildren.length)
          .toEqual(3);
      expect(childGhostChildren[0])
          .toEqual(grandChildGhost);
      expect(childGhostChildren[2])
          .toEqual(vGuest);
    });
  });

  describe("abstraction piercing operations", () => {
    it("recurses materialized fields: ['children']", () => {
      harness = createEngineTestHarness({ debug: 0, claimBaseBlock: false }, [
        transactionA, createAInstance,
      ]);
      expect(harness.engine.getVrapper("test")
              .do(VALEK.recurseMaterializedFieldResources(["children"]).map("rawId")))
          .toEqual(["child", "grandChild", "greatGrandChild", "grandSibling"]);
    });
    it("doesn't recurse immaterialized fields: ['children']", () => {
      harness = createEngineTestHarness({ debug: 0, claimBaseBlock: false }, [
        transactionA, createAInstance,
      ]);
      expect(harness.engine.getVrapper("test#1")
              .do(VALEK.recurseMaterializedFieldResources(["children"]).map("rawId")))
          .toEqual([]);
    });
    it("recurses materialized fields: ['unnamedOwnlings']", () => {
      harness = createEngineTestHarness({ debug: 0, claimBaseBlock: false }, [
        transactionA, createAInstance,
      ]);
      expect(harness.engine.getVrapper("test")
              .do(VALEK.recurseMaterializedFieldResources(["unnamedOwnlings"]).map("rawId")))
          .toEqual(["ownling"]);
    });
    it("recurses materialized fields: ['children', 'unnamedOwnlings']", () => {
      harness = createEngineTestHarness({ debug: 0, claimBaseBlock: false }, [
        transactionA, createAInstance,
      ]);
      expect(harness.engine.getVrapper("test")
              .do(VALEK.recurseMaterializedFieldResources(["children", "unnamedOwnlings"])
                  .map("rawId")))
          .toEqual(["child", "grandChild", "greatGrandChild", "greatGrandChildOwnling",
            "grandSibling", "ownling",
          ]);
    });
    it("0000101: recurseMaterializedFieldResources kueries must not leak non-vrapped data", () => {
      // Bug was indeed directly with recurseMaterializedFieldResources: it was returning packed
      // transients inside a native container, which is forbidden.
      harness = createEngineTestHarness({ debug: 0, claimBaseBlock: false }, [
        created({ id: "top", typeName: "Entity", initialState: {
          name: "TopElement",
        }, }),
        created({ id: "middleA", typeName: "Entity", initialState: {
          name: "MiddleElementA",
          owner: vRef("top"),
        }, }),
        created({ id: "middleB", typeName: "Entity", initialState: {
          name: "MiddleElementB",
          owner: vRef("top"),
        }, }),
        created({ id: "bottom", typeName: "Entity", initialState: {
          name: "BottomElement",
          owner: vRef("middleA"),
        }, }),
      ]);
      const top = entities().top;
      const recurseKuery = VALEK.recurseMaterializedFieldResources(["unnamedOwnlings"]);
      const filtered = top.get(recurseKuery.filter(VALEK.isTruthy()));
      const unfiltered = top.get(recurseKuery);

      expect(filtered[0] instanceof Vrapper).toEqual(true);
      expect(unfiltered[0] instanceof Vrapper).not.toEqual(false); // <-- differentiate jest output
    });
  });

  const basicProperties = {
    type: "TRANSACTED",
    actions: [
      created({ id: "test.testField", typeName: "Property", initialState: {
        owner: vRef("test", "properties"),
        name: "testField",
        value: { typeName: "Literal", value: "testOwned.testField" },
      }, }),
      created({ id: "test.secondField", typeName: "Property", initialState: {
        owner: vRef("test", "properties"),
        name: "secondField",
        value: { typeName: "Literal", value: "testOwned.secondField" },
      }, }),
      created({ id: "grandChild.testField", typeName: "Property", initialState: {
        owner: vRef("grandChild", "properties"),
        name: "testField",
        value: { typeName: "Literal", value: "grandChildOwned.testField" },
      }, }),
      created({ id: "grandSibling.siblingField", typeName: "Property", initialState: {
        owner: vRef("grandSibling", "properties"),
        name: "siblingField",
        value: { typeName: "Literal", value: "grandSiblingOwned.siblingField" },
      }, }),
    ],
  };

  describe("lexical scope - basic accesses", () => {
    it("reads Scope property values through the Scope's lexicalScope kuery", () => {
      harness = createEngineTestHarness({ debug: 0, claimBaseBlock: false }, [
        transactionA, createAInstance, basicProperties,
      ]);
      expect(testScriptPartitions().test.get(VALEK.fromScope("testField").toValueLiteral()))
          .toEqual("testOwned.testField");
      expect(testScriptPartitions().test.get(VALEK.fromScope("secondField").toValueLiteral()))
          .toEqual("testOwned.secondField");
    });

    it("accesses grand-parent Scope properties through lexicalScope", () => {
      harness = createEngineTestHarness({ debug: 0, claimBaseBlock: false }, [
        transactionA, createAInstance, basicProperties,
      ]);
      expect(testScriptPartitions().grandChild.get(VALEK.fromScope("secondField").toValueLiteral()))
          .toEqual("testOwned.secondField");
    });

    it("accesses overridden grand-parent Scope property through lexicalScope", () => {
      harness = createEngineTestHarness({ debug: 0, claimBaseBlock: false }, [
        transactionA, createAInstance, basicProperties,
      ]);
      expect(testScriptPartitions().grandChild.get(VALEK.fromScope("testField").toValueLiteral()))
          .toEqual("grandChildOwned.testField");
    });
  });

  describe("lexical scope - renaming and ownership changes", () => {
    it("most recent property with a name overrides its sibling", () => {
      const oldWarn = console.warn;
      console.warn = jest.fn(); // eslint-disable-line
      harness = createEngineTestHarness({ debug: 0, claimBaseBlock: false }, [
        transactionA,
        createAInstance,
        basicProperties,
        created({ id: "test.conflictingTestField", typeName: "Property", initialState: {
          owner: vRef("test", "properties"),
          name: "testField",
          value: { typeName: "Literal", value: "testOwned.conflictingTestField" },
        }, }),
      ]);
      expect(console.warn.mock.calls.length).toBe(2);
      expect(console.warn.mock.calls[0][0])
          .toBe(`Overriding existing Property 'testField' in ${""
              }Scope Vrapper(<TestScriptyThing "testName"'VRef(test,,,)'>), with:`);
      console.warn = oldWarn;
      expect(testScriptPartitions().test.get(VALEK.fromScope("testField").toValueLiteral()))
          .toEqual("testOwned.conflictingTestField");
    });

    it("accesses renamed Scope property", () => {
      harness = createEngineTestHarness({ debug: 0, claimBaseBlock: false }, [
        transactionA, createAInstance, basicProperties,
      ]);
      testScriptPartitions().test.get(VALEK.property("testField"))
          .setField("name", "renamedField");
      expect(testScriptPartitions().test.get(VALEK.fromScope("renamedField").toValueLiteral()))
          .toEqual("testOwned.testField");
      expect(testScriptPartitions().grandChild.get(
              VALEK.fromScope("renamedField").toValueLiteral()))
          .toEqual("testOwned.testField");
      expect(testScriptPartitions().grandChild.get(VALEK.fromScope("testField").toValueLiteral()))
          .toEqual("grandChildOwned.testField");
    });

    it("fails to access previous value of a renamed Scope property", () => {
      harness = createEngineTestHarness({ debug: 0, claimBaseBlock: false }, [
        transactionA, createAInstance, basicProperties,
      ]);
      expect(testScriptPartitions().test.get(VALEK.fromScope("testField").toValueLiteral()))
          .toEqual("testOwned.testField");
      testScriptPartitions().test.get(VALEK.property("testField"))
          .setField("name", "renamedField");
      expect(() => testScriptPartitions().test.get(VALEK.fromScope("testField").toValueLiteral()))
          .toThrow(/'undefined' at notNull assertion/);
    });

    it("fails to access a removed Scope value", () => {
      harness = createEngineTestHarness({ debug: 0, claimBaseBlock: false }, [
        transactionA, createAInstance, basicProperties,
      ]);
      expect(testScriptPartitions().test.get(VALEK.fromScope("testField").toValueLiteral()))
          .toEqual("testOwned.testField");
      testScriptPartitions().test.get(VALEK.property("testField"))
          .destroy();
      expect(() => testScriptPartitions().test.get(VALEK.fromScope("testField").toValueLiteral()))
          .toThrow(/'undefined' at notNull assertion/);
    });

    it("updates lexicalScope when reparented", () => {
      harness = createEngineTestHarness({ debug: 0, claimBaseBlock: false }, [
        transactionA, createAInstance, basicProperties,
      ]);
      testScriptPartitions().greatGrandChild.emplaceAddToField("properties", {
        name: "ggField", value: { typeName: "Literal", value: "ggChildOwned.ggField" }
      });
      expect(testScriptPartitions().greatGrandChild.get(
              VALEK.fromScope("ggField").toValueLiteral()))
          .toEqual("ggChildOwned.ggField");
      expect(testScriptPartitions().greatGrandChild.get(
              VALEK.fromScope("testField").toValueLiteral()))
          .toEqual("grandChildOwned.testField");
      expect(() => testScriptPartitions().greatGrandChild.get(
              VALEK.fromScope("siblingField").toValueLiteral()))
          .toThrow(/'undefined' at notNull assertion/);
      testScriptPartitions().greatGrandChild.setField(
          "parent", testScriptPartitions().grandSibling);
      expect(testScriptPartitions().greatGrandChild.get(
              VALEK.fromScope("ggField").toValueLiteral()))
          .toEqual("ggChildOwned.ggField");
      expect(testScriptPartitions().greatGrandChild.get(
              VALEK.fromScope("testField").toValueLiteral()))
          .toEqual("testOwned.testField");
      expect(testScriptPartitions().greatGrandChild.get(
              VALEK.fromScope("siblingField").toValueLiteral()))
          .toEqual("grandSiblingOwned.siblingField");
    });

    it("fails to access a Scope property with no name", () => {
      harness = createEngineTestHarness({ debug: 0, claimBaseBlock: false }, [
        transactionA, createAInstance, basicProperties,
        created({ id: "test.namelessField", typeName: "Property", initialState: {
          owner: vRef("test", "properties"),
          name: "",
          value: { typeName: "Literal", value: "testOwned.namelessField" },
        }, }),
      ]);
      expect(() => testScriptPartitions().test.get(VALEK.fromScope("").toValueLiteral()))
          .toThrow(/'undefined' at notNull assertion/);
    });
  });
});
