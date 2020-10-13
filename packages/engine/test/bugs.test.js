
import { created } from "~/raem/events";
import { vRef } from "~/raem/VRL";

import { testRootId, createEngineTestHarness, createEngineOracleHarness }
    from "~/engine/test/EngineTestHarness";
import VALEK from "~/engine/VALEK";

import { valueExpression, transpileValoscriptBody } from "~/script";

let harness: { createds: Object, engine: Object, sourcerer: Object, testEntities: Object };
afterEach(() => { harness = null; }); // eslint-disable-line no-undef

const entities = () => harness.createds.Entity;

describe("Engine bug tests", async () => {
  it("0000049: creates an entity with property and duplicates it", async () => {
    // This test could be extracted as a separate DUPLICATED test case somewhere
    const commands = [
      created({ id: ["Foo"], typeName: "Entity", initialState: {
        owner: [testRootId],
        name: "Foo",
      }, }),
      created({ id: ["FooTen"], typeName: "Property", initialState: {
        name: "Ten",
        owner: vRef("Foo", "properties"),
        value: valueExpression(10),
      }, }),
      created({ id: ["FooSelfPtr"], typeName: "Property", initialState: {
        name: "SelfPtr",
        owner: vRef("Foo", "properties"),
        value: valueExpression(vRef("Foo")),
      }, }),
      created({ id: ["FooChild"], typeName: "Entity", initialState: {
        name: "Child",
        owner: vRef("Foo"),
      }, }),
      created({ id: ["FooChildPtr"], typeName: "Property", initialState: {
        name: "ChildPtr",
        owner: vRef("Foo", "properties"),
        value: valueExpression(vRef("FooChild")),
      }, }),
      created({ id: ["Bar"], typeName: "Entity", initialState: {
        owner: [testRootId],
        name: "Bar",
      }, }),
      created({ id: ["FooBarPtr"], typeName: "Property", initialState: {
        name: "BarPtr",
        owner: vRef("Foo", "properties"),
        value: valueExpression(vRef("Bar")),
      }, }),
    ];

    harness = await createEngineOracleHarness({
      verbosity: 0, claimBaseBlock: false, acquireConnections: ["@$~raw.Foo@@"],
    }, commands);

    const foo = entities().Foo;
    const fooInst = foo.duplicate();

    const noUnpackEngine = Object.create(harness.engine.discourse);
    noUnpackEngine.setHostValueUnpacker(null);

    expect(foo.step(VALEK.to("properties")).length)
        .toEqual(4);
    expect(fooInst.step(VALEK.to("properties")).length)
        .toEqual(4);

    expect(foo.step(VALEK.propertyValue("Ten")))
        .toEqual(10);
    expect(fooInst.step(VALEK.propertyValue("Ten")))
        .toEqual(10);
    expect(fooInst.step(VALEK.property("Ten")))
        .not.toBe(foo.step(VALEK.property("Ten")));
    expect(noUnpackEngine.run(fooInst, VALEK.property("Ten").to("value")))
        .toBe(noUnpackEngine.run(foo, VALEK.property("Ten").to("value")));

    expect(foo.step(VALEK.propertyValue("BarPtr")))
        .toBe(entities().Bar);
    expect(fooInst.step(VALEK.propertyValue("BarPtr")))
        .toBe(entities().Bar);
    expect(fooInst.step(VALEK.property("BarPtr")))
        .not.toBe(foo.step(VALEK.property("BarPtr")));
    expect(noUnpackEngine.run(fooInst, VALEK.property("BarPtr").to("value")))
        .toEqual(noUnpackEngine.run(foo, VALEK.property("BarPtr").to("value")));

    expect(foo.step(VALEK.propertyValue("SelfPtr")))
        .toBe(foo);
    expect(fooInst.step(VALEK.propertyValue("SelfPtr")))
        .toBe(fooInst);
    expect(fooInst.step(VALEK.property("SelfPtr")))
        .not.toBe(foo.step(VALEK.property("SelfPtr")));
    expect(noUnpackEngine.run(fooInst, VALEK.property("SelfPtr").to("value")).toJS())
        .not.toEqual(noUnpackEngine.run(foo, VALEK.property("SelfPtr").to("value")).toJS());

    expect(foo.step(VALEK.propertyValue("ChildPtr")))
        .toBe(entities().FooChild);
    expect(fooInst.step(VALEK.propertyValue("ChildPtr")))
        .toBe(fooInst.step(VALEK.to("unnamedOwnlings").toIndex(0)));
    expect(fooInst.step(VALEK.property("ChildPtr")))
        .not.toBe(foo.step(VALEK.property("ChildPtr")));
    expect(noUnpackEngine.run(fooInst, VALEK.property("ChildPtr").to("value")).toJS())
        .not.toEqual(noUnpackEngine.run(foo, VALEK.property("ChildPtr").to("value")).toJS());
  });

  it("0000086: destroys unnamedOwnlings objects", () => {
    harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true });
    const bodyText = `
      () => {
        const ownlings = this.$toField("unnamedOwnlings");
        if (ownlings.length === 0) return;
        for (let x = 0; x < ownlings.length; x++) {
          const ownling = ownlings[x];
          if (ownlings[x].$toField("name") === "ownlingPrototype") {
            Entity.destroy(ownling);
          }
        }
      }
    `;
    const moduleKuery = transpileValoscriptBody(bodyText, { customVALK: VALEK });
    const ownlingPrototypeDestroyer = entities().test.do(moduleKuery);
    expect(entities().test.step("unnamedOwnlings").length)
        .toEqual(3);
    expect(harness.engine.tryVrapper("ownling_prototype"))
        .toBeTruthy();
    ownlingPrototypeDestroyer();
    expect(entities().test.step("unnamedOwnlings").length)
        .toEqual(2);
    expect(harness.engine.tryVrapper("ownling_prototype"))
        .toBeFalsy();
  });

  it("0000087: Valoscript has unexpected behaviour with conditional branches and returns", () => {
    harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true });
    const bodyText = `
      const entity = {
        a: 1,
        b: () => 2,
        c: {
          A: 3,
          B: 4,
        },
        d: {
          x: () => () => 5,
          y: 6
        },
      };

      const unthunk = (o) => {
        // console.log("is function?", typeof o, typeof o === 'function', o);
        if (typeof o === 'function') {
          const ret = unthunk(o());
          // console.log("return unthunk(o()):", ret);
          return ret;
        }
        // console.log("is object?", typeof o, typeof o === 'object', o);
        if (typeof o === 'object') {
          const keys = Object.keys(o);
          const result = {}
          for (let k = 0; k < keys.length; k++) {
            const key = keys[k];
            const value = o[key];
            result[key] = unthunk(o[key]);
            // console.log("key", key, result[key]);
          }
          return result;
        }
        // console.log("is Entity?", typeof o, typeof o === 'object', o);
        if (typeof o === 'Entity') {
          const keys = Entity.keys(o);
          const result = {};
          for (let k = 0; k < keys.length; k++) {
            const key = keys[k];
            const value = o[key];
            result[key] = unthunk(o[key]);
          }
          return result;
        }
        return o;
      }

      unthunk(entity);
    `;
    const bodyKuery = transpileValoscriptBody(bodyText, { customVALK: VALEK });
    const unthunkedResult = entities().test.do(bodyKuery, { verbosity: 0 });
    expect(unthunkedResult)
        .toEqual({ a: 1, b: 2, c: { A: 3, B: 4 }, d: { x: 5, y: 6 } });
  });

  it("0000599: incomingrelations fail", () => {
    harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true });
    const bodyText = `
      const destroyedThing = new Entity({ owner: this });

      const defaultThing = new Entity({ owner: this });
      // [defaultThing.$V.incomingRelations];

      const oneThing = new Entity({ owner: this });
      new Relation({ name: "TO_ONE", source: defaultThing, target: oneThing,
        properties: { v: 0 },
      });

      const clearedThing = new Entity({ owner: this });
      new Relation({ name: "TO_CLEARED", source: destroyedThing, target: clearedThing,
        properties: { v: 1 },
      });

      const defaultInstance = new defaultThing({ owner: this });
      const oneInstance = new oneThing({ owner: this });
      const clearedInstance = new clearedThing({ owner: this });

      const defaultManipulated = new defaultThing({ owner: this });
      const oneManipulated = new oneThing({ owner: this });
      const clearedManipulated = new clearedThing({ owner: this });
      new Relation({ name: "TO_CLEARED", source: destroyedThing, target: defaultManipulated,
        properties: { v: 2 },
      });
      new Relation({ name: "TO_CLEARED", source: destroyedThing, target: oneManipulated,
        properties: { v: 3 },
      });
      new Relation({ name: "TO_CLEARED", source: destroyedThing, target: clearedManipulated,
        properties: { v: 4 },
      });

      valos.Resource.destroy(destroyedThing);

      new Relation({ name: "TO_ONE", source: defaultThing, target: defaultManipulated,
        properties: { v: 5 },
      });
      new Relation({ name: "TO_ONE", source: defaultThing, target: oneManipulated,
        properties: { v: 6 },
      });
      new Relation({ name: "TO_ONE", source: defaultThing, target: clearedManipulated,
        properties: { v: 7 },
      });
      [
        defaultThing, oneThing, clearedThing,
        defaultInstance, oneInstance, clearedInstance,
        defaultManipulated, oneManipulated, clearedManipulated,
      ].map(e => (e.$V.incomingRelations || []).map(r => ({ name: r.$V.name, v: r.v })));
    `;
    const bodyKuery = transpileValoscriptBody(bodyText, { customVALK: VALEK });
    const [
      defaultThingIR, oneThingIR, clearedThingIR,
      defaultInstanceIR, oneInstanceIR, clearedInstanceIR,
      defaultManipulatedIR, oneManipulatedIR, clearedManipulatedIR,
    ] = entities().test.do(bodyKuery, { verbosity: 0 });
    expect(defaultThingIR).toEqual([]);
    expect(oneThingIR).toEqual([{ name: "TO_ONE", v: 0 }]);
    expect(clearedThingIR).toEqual([]);
    expect(defaultInstanceIR).toEqual([]);
    expect(oneInstanceIR).toEqual([{ name: "TO_ONE", v: 0 }]);
    expect(clearedInstanceIR).toEqual([]);
    expect(defaultManipulatedIR).toEqual([{ name: "TO_ONE", v: 5 }]);
    expect(oneManipulatedIR).toEqual([{ name: "TO_ONE", v: 0 }, { name: "TO_ONE", v: 6 }]);
    expect(clearedManipulatedIR).toEqual([{ name: "TO_ONE", v: 7 }]);
  });

  it("Allows both low-level and high manipulation of transient objects", () => {
    harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true });
    const bodyText = `
      const test = () => {
        const owner = this;
        const relationToOwnedEntity = new valos.Relation({
            name: "Relation To Owned Entity", owner,
        });
        const ownedEntity = new valos.Entity({
            name: "Owned Entity", owner: relationToOwnedEntity,
        });
        relationToOwnedEntity[valos.Relation.target] = ownedEntity;
        ownedEntity.pointerToRelationThatOwnsIt = relationToOwnedEntity;
        return ownedEntity.pointerToRelationThatOwnsIt === relationToOwnedEntity;
      }
      test();
    `;
    const bodyKuery = transpileValoscriptBody(bodyText, { customVALK: VALEK });
    const result = entities().test.do(bodyKuery, { verbosity: 0 });
    expect(result).toEqual(true);
  });

  it("immaterializes a Property.value using REMOVED_FROM", () => {
    harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true });
    const bodyText = `
      const Proto = new Entity({ owner: this, properties: { foo: 10 }});
      const instance = new Proto({ owner: this });
      instance.foo = 20;
      delete instance.foo;
      instance.foo;
    `;
    const bodyKuery = transpileValoscriptBody(bodyText, { customVALK: VALEK });
    const result = entities().test.do(bodyKuery, { verbosity: 0 });
    expect(result).toEqual(10);
  });

  it("doesn't redefine global scope 'this' inside call expressions", () => {
    harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true });
    const bodyText = `
      const foo = this;
      Object.assign({}, { counter: this.counter });
    `;
    const bodyKuery = transpileValoscriptBody(bodyText, { customVALK: VALEK, verbosity: 0 });
    const result = entities().creator.do(bodyKuery, { verbosity: 0 });
    expect(result.counter).toEqual(0);
  });

  it("renames and modifies $V.name of an Entity resource", () => {
    harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true });
    const bodyText = `
      const foo = new Entity({ name: "text", owner: this });
      foo.$V.name = "prefix";
      foo.$V.name += "suffix";
    `;
    const bodyKuery = transpileValoscriptBody(bodyText, { customVALK: VALEK, verbosity: 0 });
    const result = entities().creator.do(bodyKuery, { verbosity: 0 });
    expect(result).toEqual("prefixsuffix");
  });

  it(`creates a chronicle with reference to non-existent chronicle`, async () => {
    harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true });
    const properties = {
      reference: vRef(
          "@$~raw.secondchronicle@@", null, null, "valaa-memory:?id=@$~raw.secondchronicle@@"),
    };
    await harness.runValoscript(null, `
      new Entity({
        owner: null,
        name: "firstChronicle",
        authorityURI: "valaa-memory:",
        properties
      });

      new Entity({
        id: "@$~raw.secondchronicle@@",
        owner: null,
        name: "secondChronicle",
        authorityURI: "valaa-memory:"
      });
    `, { properties }, { awaitResult: (result) => result.getComposedEvent() });
  });

  it(`handles 'null' values in arrays`, async () => {
    harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true });
    const values = await harness.runValoscript(null, `
      const ret = new Entity({ owner: null, name: "root", authorityURI: "valaa-memory:" });
      ret.values = [1, null, "test"];
      ret.values;
    `, { console });
    expect(values)
        .toEqual([1, null, "test"]);
  });
});
