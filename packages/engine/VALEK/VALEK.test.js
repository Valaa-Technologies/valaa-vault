// @flow

import { createEngineTestHarness } from "~/engine/test/EngineTestHarness";
import VALEK from "~/engine/VALEK";

describe("VALEK extensions", () => {
  let harness: { createds: Object, engine: Object, prophet: Object, testEntities: Object };
  const entities = () => harness.createds.Entity;


  const expectVrapper = rawId => { expect(harness.engine.tryVrapper(rawId)).toBeTruthy(); };
  // const expectNoVrapper = rawId => { expect(harness.engine.tryVrapper(rawId)).toBeFalsy(); };

  describe("VALEK mutations", () => {
    it("creates a resource using VALEK.create", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true });
      expectVrapper("test");

      // This emulates a VALK JS function definition: it expects head to be the vBuilder
      const toCreation = VALEK.setScopeValues({
        root: ["§->", null],
        article: VALEK.create("Entity", {
          name: VALEK.add("article-", VALEK.propertyLiteral("counter"), "-name"),
          owner: VALEK.toField("owner"),
          instancePrototype: VALEK.propertyTarget("template"),
        }),
      }).fromScope();
      const scope = entities().creator.do(toCreation.toVAKON());
      expect(scope.article.get("name"))
          .toEqual("article-0-name");
      expect(entities().test.get(
          VALEK.to("unnamedOwnlings").find(VALEK.hasName("article-0-name"))))
          .toEqual(harness.engine.getVrapperByRawId(scope.article.get("rawId")));
    });
  });

  describe("VALEK property* conveniences", () => {
    it("throws on non-optional propertyTarget access when actual data is a Literal", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true });
      expectVrapper("creator");
      expect(() => entities().creator.get(VALEK.propertyTarget("counter")))
          .toThrow(/Schema introspection missing for field 'Literal.reference'/);
    });
    it("returns null non-optional propertyTarget access when actual data is a Literal", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true });
      expectVrapper("creator");
      expect(entities().creator.get(VALEK.propertyTarget("counter", { optional: true })))
          .toEqual(undefined);
    });
    it("throws on non-optional propertyLiteral access when actual data is an Identifier", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true });
      expectVrapper("creator");
      expect(() => entities().creator.get(VALEK.propertyLiteral("template")))
          .toThrow(/Schema introspection missing for field 'Identifier.value'/);
    });
    it("returns null non-optional propertyLiteral access when actual data is a Identifier", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true });
      expectVrapper("creator");
      expect(entities().creator.get(VALEK.propertyLiteral("template", { optional: true })))
          .toEqual(undefined);
    });
  });
});
