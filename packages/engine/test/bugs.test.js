
import { created } from "~/raem/events";
import { vRef } from "~/raem/ValaaReference";

import { createEngineTestHarness, createEngineOracleHarness } from "~/engine/test/EngineTestHarness";
import VALEK, { literal, pointer } from "~/engine/VALEK";

import { transpileValaaScriptBody } from "~/script";

let harness: { createds: Object, engine: Object, prophet: Object, testEntities: Object };
afterEach(() => { harness = null; }); // eslint-disable-line no-undef

const entities = () => harness.createds.Entity;

describe("Engine bug tests", async () => {
  it("0000049: creates an entity with property and duplicates it", async () => {
    // This test could be extracted as a separate DUPLICATED test case somewhere
    const commands = [
      created({ id: ["Foo"], typeName: "Entity", initialState: {
        owner: ["test_partition"],
        name: "Foo",
      }, }),
      created({ id: ["FooTen"], typeName: "Property", initialState: {
        name: "Ten",
        owner: vRef("Foo", "properties"),
        value: literal(10),
      }, }),
      created({ id: ["FooSelfPtr"], typeName: "Property", initialState: {
        name: "SelfPtr",
        owner: vRef("Foo", "properties"),
        value: pointer(vRef("Foo")),
      }, }),
      created({ id: ["FooChild"], typeName: "Entity", initialState: {
        name: "Child",
        owner: vRef("Foo"),
      }, }),
      created({ id: ["FooChildPtr"], typeName: "Property", initialState: {
        name: "ChildPtr",
        owner: vRef("Foo", "properties"),
        value: pointer(vRef("FooChild")),
      }, }),
      created({ id: ["Bar"], typeName: "Entity", initialState: {
        owner: ["test_partition"],
        name: "Bar",
      }, }),
      created({ id: ["FooBarPtr"], typeName: "Property", initialState: {
        name: "BarPtr",
        owner: vRef("Foo", "properties"),
        value: pointer(vRef("Bar")),
      }, }),
    ];

    harness = await createEngineOracleHarness({
      verbosity: 0, claimBaseBlock: false, acquirePartitions: ["Foo"],
    }, commands);

    const foo = entities().Foo;
    const fooInst = foo.duplicate();

    const noUnpackEngine = harness.engine.discourse.fork();
    noUnpackEngine.setHostValueUnpacker(null);

    expect(foo.get(VALEK.to("properties")).length)
        .toEqual(4);
    expect(fooInst.get(VALEK.to("properties")).length)
        .toEqual(4);

    expect(foo.get(VALEK.propertyValue("Ten")))
        .toEqual(10);
    expect(fooInst.get(VALEK.propertyValue("Ten")))
        .toEqual(10);
    expect(fooInst.get(VALEK.property("Ten")))
        .not.toBe(foo.get(VALEK.property("Ten")));
    expect(noUnpackEngine.run(fooInst, VALEK.property("Ten").to("value")))
        .toBe(noUnpackEngine.run(foo, VALEK.property("Ten").to("value")));

    expect(foo.get(VALEK.propertyValue("BarPtr")))
        .toBe(entities().Bar);
    expect(fooInst.get(VALEK.propertyValue("BarPtr")))
        .toBe(entities().Bar);
    expect(fooInst.get(VALEK.property("BarPtr")))
        .not.toBe(foo.get(VALEK.property("BarPtr")));
    expect(noUnpackEngine.run(fooInst, VALEK.property("BarPtr").to("value")))
        .toEqual(noUnpackEngine.run(foo, VALEK.property("BarPtr").to("value")));

    expect(foo.get(VALEK.propertyValue("SelfPtr")))
        .toBe(foo);
    expect(fooInst.get(VALEK.propertyValue("SelfPtr")))
        .toBe(fooInst);
    expect(fooInst.get(VALEK.property("SelfPtr")))
        .not.toBe(foo.get(VALEK.property("SelfPtr")));
    expect(noUnpackEngine.run(fooInst, VALEK.property("SelfPtr").to("value")).toJS())
        .not.toEqual(noUnpackEngine.run(foo, VALEK.property("SelfPtr").to("value")).toJS());

    expect(foo.get(VALEK.propertyValue("ChildPtr")))
        .toBe(entities().FooChild);
    expect(fooInst.get(VALEK.propertyValue("ChildPtr")))
        .toBe(fooInst.get(VALEK.to("unnamedOwnlings").toIndex(0)));
    expect(fooInst.get(VALEK.property("ChildPtr")))
        .not.toBe(foo.get(VALEK.property("ChildPtr")));
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
    const moduleKuery = transpileValaaScriptBody(bodyText, { customVALK: VALEK });
    const ownlingPrototypeDestroyer = entities().test.do(moduleKuery);
    expect(entities().test.get("unnamedOwnlings").length)
        .toEqual(3);
    expect(harness.engine.tryVrapper("ownling_prototype"))
        .toBeTruthy();
    ownlingPrototypeDestroyer();
    expect(entities().test.get("unnamedOwnlings").length)
        .toEqual(2);
    expect(harness.engine.tryVrapper("ownling_prototype"))
        .toBeFalsy();
  });

  it("0000087: ValaaScript has unexpected behaviour with conditional branches and returns", () => {
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
    const bodyKuery = transpileValaaScriptBody(bodyText, { customVALK: VALEK });
    const unthunkedResult = entities().test.do(bodyKuery, { verbosity: 0 });
    expect(unthunkedResult)
        .toEqual({ a: 1, b: 2, c: { A: 3, B: 4 }, d: { x: 5, y: 6 } });
  });

  it("Allows both low-level and high manipulation of transient objects", () => {
    harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true });
    const bodyText = `
      const test = () => {
        const owner = this;
        const relationToOwnedEntity = new Valaa.Relation({
            name: "Relation To Owned Entity", owner,
        });
        const ownedEntity = new Valaa.Entity({
            name: "Owned Entity", owner: relationToOwnedEntity,
        });
        relationToOwnedEntity[Valaa.Relation.target] = ownedEntity;
        ownedEntity.pointerToRelationThatOwnsIt = relationToOwnedEntity;
        return ownedEntity.pointerToRelationThatOwnsIt === relationToOwnedEntity;
      }
      test();
    `;
    const bodyKuery = transpileValaaScriptBody(bodyText, { customVALK: VALEK });
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
    const bodyKuery = transpileValaaScriptBody(bodyText, { customVALK: VALEK });
    const result = entities().test.do(bodyKuery, { verbosity: 0 });
    expect(result).toEqual(10);
  });

  it("doesn't redefine global scope 'this' inside call expressions", () => {
    harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true });
    const bodyText = `
      const foo = this;
      Object.assign({}, { counter: this.counter });
    `;
    const bodyKuery = transpileValaaScriptBody(bodyText, { customVALK: VALEK, verbosity: 0 });
    const result = entities().creator.do(bodyKuery, { verbosity: 0 });
    expect(result.counter).toEqual(0);
  });
});
