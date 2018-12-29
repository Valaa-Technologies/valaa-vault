/* global jest describe expect beforeEach it */

import { created } from "~/raem/events";
import { vRef } from "~/raem/ValaaReference";

import { transpileValaaScriptBody } from "~/script";

import { createEngineTestHarness } from "~/engine/test/EngineTestHarness";
import VALEK, { pointer } from "~/engine/VALEK";

const valaaScriptBlock = [
  created({ id: ["creator-myStatement"], typeName: "Entity", initialState: {
    name: "myStatement", owner: vRef("creator"),
  }, }),
  created({ id: ["creator-myFunction"], typeName: "Entity", initialState: {
    name: "myFunction", owner: vRef("creator"),
  }, }),
  created({ id: ["creator-pointerTo-myStatement"], typeName: "Property", initialState: {
    name: "toMyStatement", owner: vRef("creator", "properties"),
    value: pointer(["creator-myStatement"]),
  }, }),
  created({ id: ["creator-pointerTo-myFunction"], typeName: "Property", initialState: {
    name: "toMyFunction", owner: vRef("creator", "properties"),
    value: pointer(["creator-myFunction"]),
  }, }),
];

let harness: { createds: Object, engine: Object, prophet: Object, testEntities: Object };
afterEach(() => { harness = null; }); // eslint-disable-line no-undef

const entities = () => harness.createds.Entity;
// const properties = () => harness.createds.Property;
// const relations = () => harness.createds.Relation;

function transpileValaaScriptTestBody (bodyText: string) {
  return transpileValaaScriptBody(bodyText, { customVALK: VALEK });
}

describe("transpileValaaScriptBody with Engine scriptAPI", () => {
  describe("Creating and instancing with 'new' keyword", () => {
    it("creates with 'new' a new Entity", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, valaaScriptBlock);
      const bodyText = `
          new Entity({ name: "myEntity", owner: this, properties: { foo: 10 } });
      `;
      const bodyKuery = transpileValaaScriptTestBody(bodyText);
      const myEntity = entities().creator.do(bodyKuery);
      expect(myEntity.get("name"))
          .toEqual("myEntity");
      expect(myEntity.get(VALEK.propertyLiteral("foo")))
          .toEqual(10);
      expect(entities().creator.get(
              VALEK.to("unnamedOwnlings").filter(VALEK.hasName("myEntity")).to(0)))
          .toEqual(myEntity);
    });
    it("adds with 'new' a child Relation to an existing Entity", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, valaaScriptBlock);
      const bodyText = `
          const parent = new Entity({ name: "parent", owner: this,
              properties: { position: { x: 10, y: 20 } } });
          new Relation({ name: "myRelation", owner: parent,
              properties: { position: { x: 1, y: 2 } } });
      `;
      const bodyKuery = transpileValaaScriptTestBody(bodyText);
      const myRelation = entities().creator.do(bodyKuery);
      expect(myRelation.get("name"))
          .toEqual("myRelation");
      expect(myRelation.get(VALEK.propertyLiteral("position")))
          .toEqual({ x: 1, y: 2 });
      const MyTypeEntity = myRelation.get("owner");
      expect(MyTypeEntity.get("name"))
          .toEqual("parent");
      expect(MyTypeEntity.get(VALEK.relations("myRelation").to(0)))
          .toEqual(myRelation);
    });
    it("modifies existing Entity property", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, valaaScriptBlock);
      const bodyText = `
          const parent = new Entity({ name: "parent", owner: this,
              properties: { position: { x: 10, y: 20 } } });
          [parent, parent.position = { x: 11, y: 22 }];
      `;
      const bodyKuery = transpileValaaScriptTestBody(bodyText);
      const [parent, position] = entities().creator.do(bodyKuery);
      expect(position)
          .toEqual({ x: 11, y: 22 });
      expect(parent.get(VALEK.propertyLiteral("position")))
          .toEqual({ x: 11, y: 22 });
    });
    it("instantiates with 'new' an Entity which has ownlings", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, valaaScriptBlock);
      const bodyText = `
          const MyType = new Entity({ name: "MyType", owner: this,
              properties: { position: { x: 10, y: 20 } } });
          const target = new Entity({ name: "targetOfRelation", owner: this });
          const relation = new Relation({ name: "myTypeRelation", owner: MyType, target: target,
              properties: { position: { x: 1, y: 2 } } });
          const instance = new MyType({ name: "instance", owner: this,
              properties: { position: { x: 100, y: 200 } } });
          MyType.position = { x: 11, y: 22 };
          relation.orientation = { a: 90 };
          target.payload = "data";
          const instanceRelation = instance[Entity.getRelations]("myTypeRelation")[0];
          instanceRelation.orientation = { a: 180 };
          instanceRelation[Relation.target].secondPayload = "more data";
          instance;
      `;
      const bodyKuery = transpileValaaScriptTestBody(bodyText);

      const instance = entities().creator.do(bodyKuery);

      expect(instance.get("name"))
          .toEqual("instance");
      expect(instance.get(VALEK.propertyLiteral("position")))
          .toEqual({ x: 100, y: 200 });

      const MyTypeEntity = instance.get("prototype");
      expect(MyTypeEntity.get("name"))
          .toEqual("MyType");
      expect(MyTypeEntity.get(VALEK.to("instances").to(0)))
          .toEqual(instance);
      expect(MyTypeEntity.get(VALEK.propertyLiteral("position")))
          .toEqual({ x: 11, y: 22 });

      const MyTypeRelation = MyTypeEntity.get(VALEK.relations("myTypeRelation").to(0));
      expect(MyTypeRelation.get("name"))
          .toEqual("myTypeRelation");
      expect(MyTypeRelation.get(VALEK.propertyLiteral("orientation")))
          .toEqual({ a: 90 });
      expect(MyTypeRelation.get(VALEK.to("target").propertyLiteral("payload")))
          .toEqual("data");

      const instanceRelation = instance.get(VALEK.relations("myTypeRelation").to(0));
      expect(instanceRelation.get("name"))
          .toEqual("myTypeRelation");
      expect(instanceRelation.get(VALEK.propertyLiteral("orientation")))
          .toEqual({ a: 180 });
      expect(instanceRelation.get(VALEK.to("target").propertyLiteral("payload")))
          .toEqual("data");
      expect(MyTypeRelation.get(VALEK.to("target").propertyLiteral("secondPayload")))
          .toEqual("more data");
      expect(instanceRelation.get(VALEK.to("target").propertyLiteral("secondPayload")))
          .toEqual("more data");
    });
    it("returns the result of an expression with properties correctly", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, valaaScriptBlock);
      const bodyText = `
          const entity = new Entity({ name: "theEntity", owner: this,
              properties: { numbers: { a: 1, b: 2 } } });
          entity.numbers.a + entity.numbers.b;
      `;
      const bodyKuery = transpileValaaScriptTestBody(bodyText);
      const number = entities().creator.do(bodyKuery);
      expect(number).toEqual(3);
    });
    it("accesses array values using a number for index correctly", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, valaaScriptBlock);
      const bodyText = `
          const values = [3,4,5,6,7,8];
          values[3];
      `;
      const bodyKuery = transpileValaaScriptTestBody(bodyText);
      const number = entities().creator.do(bodyKuery);
      expect(number).toEqual(6);
    });
    it("accesses array values using an expression with properties correctly", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, valaaScriptBlock);
      const bodyText = `
          const entity = new Entity({ name: "theEntity", owner: this,
              properties: { numbers: { a: 1, b: 2 } } });
          const values = [3,4,5,6,7,8];
          [entity.numbers.a + entity.numbers.b, values[entity.numbers.a + entity.numbers.b]];
      `;
      const bodyKuery = transpileValaaScriptTestBody(bodyText);
      const [index, result] = entities().creator.do(bodyKuery);
      expect(index).toEqual(3);
      expect(result).toEqual(6);
    });
    it("Accesses properties inside a function correctly", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, valaaScriptBlock);
      const bodyText = `
          const entity = new Entity({ name: "entity", owner: this,
              properties: { numbers: { a: 1, b: 2 } } });
          function f () {
              return 400 + g(entity.numbers.a + 1, entity.numbers.b);
          };
          function g (a, b) {
              return 40 + a + b;
          }
          4000 + f();
      `;
      const bodyKuery = transpileValaaScriptTestBody(bodyText);
      const number = entities().creator.do(bodyKuery);
      expect(number).toEqual(4444);
    });
    it("Handles 'this' accessor in arrow functions correctly", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, valaaScriptBlock);
      const bodyText = `
          this.a = 1;
          this.b = 2;
          const f = () => 400 + g(this.a + 1, this.b);
          const g = (a, b) => 40 + a + b;
          4000 + f();
      `;
      const bodyKuery = transpileValaaScriptTestBody(bodyText);
      const number = entities().creator.do(bodyKuery);
      expect(number).toEqual(4444);
    });
    it("Accesses to non-declared properties in a transient Entity resolves to undefined", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, valaaScriptBlock);
      const bodyText = `
          function functionA () {
            // console.log("inner this:", this);
            const foo = new Entity({ name: "foo", owner: this });
            if (foo.bar !== undefined) return "very much not ok";
            else return functionB(foo);
          }
          function functionB (foo) {
            if (foo.bar !== undefined) return "not ok";
            else return "ok";
          }
          functionA.call(this);
      `;
      const bodyKuery = transpileValaaScriptTestBody(bodyText);
      const result = entities().creator.do(bodyKuery);
      expect(result).toEqual("ok");
    });
  });
  describe("Object.* decorator tests", () => {
    it("handles Object.assign roundtrip from native object to Valaa resource and back", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, valaaScriptBlock);
      const bodyText = `
          const target = new Entity({ owner: this });
          const properties = { a: 1, target: target };
          const midway = new Entity({ owner: this });
          Object.assign(midway, properties);
          const result = Object.assign({}, midway);
          [target, properties, midway, result];
      `;
      const bodyKuery = transpileValaaScriptTestBody(bodyText);
      const [target, properties, midway, result] = entities().creator.do(bodyKuery);
      expect(properties).toEqual({ a: 1, target });
      expect(harness.engine.run(midway, ["§..", "a"])).toEqual(1);
      expect(harness.engine.run(midway, ["§..", "target"])).toEqual(target);
      expect(result).toEqual({ a: 1, target });
      expect(result).not.toBe(properties);
    });
    it("handles more complex Object.assign between native and Valaa resources", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, valaaScriptBlock);
      const bodyText = `
          const Proto = new Entity({ owner: this });
          const protownling = new Entity({ owner: Proto });
          Object.assign(Proto, { a: "baseA" }, { b: protownling });
          const protoProps = {};
          Object.assign(protoProps, Proto);
          Object.assign(protoProps.b, { ownP: "ownP" });
          const instance = new Proto({ owner: this, properties: {
            a: "instanceA", c: "instanceC",
          } });
          const source = new Relation({ owner: this, properties: {
            a: "relationA", d: "relationD",
          } });
          const nativeTarget = {};
          Object.assign(nativeTarget, { d: "nativeD", e: "nativeE", }, source);
          Object.assign(instance, source, { d: "nativeD", e: "nativeE", });
          [
            protownling,
            nativeTarget,
            Object.assign({}, Proto),
            Object.assign({}, source),
            instance,
            Object.assign({}, instance),
          ];
      `;
      const bodyKuery = transpileValaaScriptTestBody(bodyText);
      const [protownling, nativeProps, protoProps, sourceProps, instance, instanceProps]
          = entities().creator.do(bodyKuery);
      expect(nativeProps)
          .toEqual({ a: "relationA", d: "relationD", e: "nativeE" });
      expect(protoProps)
          .toEqual({ a: "baseA", b: protownling });
      expect(sourceProps)
          .toEqual({ a: "relationA", d: "relationD" });
      expect(instanceProps)
          .toEqual({
            a: "relationA", b: protownling.getGhostIn(instance),
            c: "instanceC", d: "nativeD", e: "nativeE",
          });
    });
    it("Sums the values of all properties in an entity using Object.keys", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, valaaScriptBlock);
      const bodyText = `
          const properties = { a: 1, b: 2, c: 3, d: 4 };
          const propertiesTotal = Object.keys(properties).reduce((t, v) => t + properties[v], 0);
          const entity = new Entity({ name: "entity", owner: this, properties });
          const total = Object.keys(entity).reduce((t, v) => t + entity[v], 0);
          [propertiesTotal, total];
      `;
      const bodyKuery = transpileValaaScriptTestBody(bodyText);
      const [propertiesTotal, number] = entities().creator.do(bodyKuery);
      expect(propertiesTotal).toEqual(1 + 2 + 3 + 4);
      expect(number).toEqual(1 + 2 + 3 + 4);
    });
    it("Sums the values of all properties in an entity using Object.values", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, valaaScriptBlock);
      const bodyText = `
          const properties = { a: 2, b: 3, c: 4, d: 5 };
          const propertiesTotal = Object.values(properties).reduce((t, v) => t + v, 0);
          const entity = new Entity({ name: "entity", owner: this, properties });
          const total = Object.values(entity).reduce((t, v) => t + v, 0);
          [propertiesTotal, total];
      `;
      const bodyKuery = transpileValaaScriptTestBody(bodyText);
      const [propertiesTotal, number] = entities().creator.do(bodyKuery);
      expect(propertiesTotal).toEqual(2 + 3 + 4 + 5);
      expect(number).toEqual(2 + 3 + 4 + 5);
    });
    it("Sums the values of all properties in an entity using Object.entries", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, valaaScriptBlock);
      const bodyText = `
          const properties = { a: 3, b: 4, c: 5, d: 6 };
          const propertiesTotal = Object.entries(properties).reduce(
              (t, v) => [((t[0][v[0]] = -v[1]), t[0]), t[1] + v[1]], [{}, 0]);
          const entity = new Entity({ name: "entity", owner: this, properties });
          const total = Object.entries(entity).reduce(
              (t, v) => [((t[0][v[0]] = -v[1]), t[0]), t[1] + v[1]], [{}, 0]);
          [propertiesTotal, total];
      `;
      const bodyKuery = transpileValaaScriptTestBody(bodyText);
      const [[propertiesInverseObject, propertiesTotal], [entityInverseObject, total]] =
          entities().creator.do(bodyKuery);
      expect(propertiesInverseObject).toEqual({ a: -3, b: -4, c: -5, d: -6 });
      expect(propertiesTotal).toEqual(3 + 4 + 5 + 6);
      expect(entityInverseObject).toEqual({ a: -3, b: -4, c: -5, d: -6 });
      expect(total).toEqual(3 + 4 + 5 + 6);
    });
    it("Object.getOwnPropertyDescriptor", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, valaaScriptBlock);
      const bodyText = `
          const properties = { a: 1, b: 2, d: this };
          const entity = new Entity({ name: "entity", owner: this, properties });
          const overriddenProperties = Object.create(properties);
          Object.assign(overriddenProperties, { a: 3, c: 4 });
          const instance = new entity({ owner: this, properties: overriddenProperties });
          ({
            propertyA: Object.getOwnPropertyDescriptor(properties, "a"),
            propertyB: Object.getOwnPropertyDescriptor(properties, "b"),
            propertyC: Object.getOwnPropertyDescriptor(properties, "c"),
            propertyD: Object.getOwnPropertyDescriptor(properties, "d"),
            entityId: Object.getOwnPropertyDescriptor(entity, Resource.id),
            entityOwner: Object.getOwnPropertyDescriptor(entity, Resource.owner),
            entityName: Object.getOwnPropertyDescriptor(entity, Valaa.name),
            entityA: Object.getOwnPropertyDescriptor(entity, "a"),
            entityB: Object.getOwnPropertyDescriptor(entity, "b"),
            entityC: Object.getOwnPropertyDescriptor(entity, "c"),
            entityD: Object.getOwnPropertyDescriptor(entity, "d"),
            overriddenPropertyA: Object.getOwnPropertyDescriptor(overriddenProperties, "a"),
            overriddenPropertyB: Object.getOwnPropertyDescriptor(overriddenProperties, "b"),
            overriddenPropertyC: Object.getOwnPropertyDescriptor(overriddenProperties, "c"),
            overriddenPropertyD: Object.getOwnPropertyDescriptor(overriddenProperties, "d"),
            instanceId: Object.getOwnPropertyDescriptor(instance, Resource.id),
            instanceOwner: Object.getOwnPropertyDescriptor(instance, Resource.owner),
            instanceName: Object.getOwnPropertyDescriptor(instance, Valaa.name),
            instanceA: Object.getOwnPropertyDescriptor(instance, "a"),
            instanceB: Object.getOwnPropertyDescriptor(instance, "b"),
            instanceC: Object.getOwnPropertyDescriptor(instance, "c"),
            instanceD: Object.getOwnPropertyDescriptor(instance, "d"),
          });
      `;
      const bodyKuery = transpileValaaScriptTestBody(bodyText);
      const descriptors = entities().creator.do(bodyKuery);
      function objectPropertyDescriptor (value: any) {
        return {
          value,
          writable: true, enumerable: true, configurable: true,
        };
      }
      function resourcePropertyDescriptor (value: any) {
        return {
          value, valaa: true, property: true, persisted: true,
          writable: true, enumerable: true, configurable: true,
        };
      }
      function hostFieldDescriptor (value: any) {
        return {
          value, valaa: true, host: true, persisted: true,
          writable: true, enumerable: false, configurable: false,
        };
      }
      expect(descriptors.propertyA).toMatchObject(objectPropertyDescriptor(1));
      expect(descriptors.propertyB).toMatchObject(objectPropertyDescriptor(2));
      expect(descriptors.propertyC).toEqual(undefined);
      expect(descriptors.propertyD.value).toBe(entities().creator);
      expect(descriptors.entityId).toEqual(undefined);
      expect(descriptors.entityOwner.value).toBe(entities().creator);
      expect(descriptors.entityName).toMatchObject(hostFieldDescriptor("entity"));
      expect(descriptors.entityA).toMatchObject(resourcePropertyDescriptor(1));
      expect(descriptors.entityB).toMatchObject(resourcePropertyDescriptor(2));
      expect(descriptors.entityC).toEqual(undefined);
      expect(descriptors.entityD.value).toEqual(entities().creator);
      expect(descriptors.overriddenPropertyA).toMatchObject(objectPropertyDescriptor(3));
      expect(descriptors.overriddenPropertyB).toEqual(undefined);
      expect(descriptors.overriddenPropertyC).toMatchObject(objectPropertyDescriptor(4));
      expect(descriptors.overriddenPropertyD).toEqual(undefined);
      expect(descriptors.instanceId).toEqual(undefined);
      expect(descriptors.instanceOwner.value).toBe(entities().creator);
      expect(descriptors.instanceName).toEqual(undefined);
      expect(descriptors.instanceA).toMatchObject(resourcePropertyDescriptor(3));
      expect(descriptors.instanceB).toEqual(undefined);
      expect(descriptors.instanceC).toMatchObject(resourcePropertyDescriptor(4));
      expect(descriptors.instanceD).toEqual(undefined);
    });
    it("Object.getOwnPropertyNames", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, valaaScriptBlock);
      const bodyText = `
          const properties = { a: 1, b: 2, d: this };
          const entity = new Entity({ name: "entity", owner: this, properties });
          const overriddenProperties = Object.create(properties);
          Object.assign(overriddenProperties, { a: 3, c: 4 });
          const instance = new entity({ owner: this, properties: overriddenProperties });
          ({
            entity: Object.assign({}, entity),
            instance: Object.assign({}, instance),
            propertiesNames: Object.getOwnPropertyNames(properties),
            entityNames: Object.getOwnPropertyNames(entity),
            overriddenPropertiesNames: Object.getOwnPropertyNames(overriddenProperties),
            instanceNames: Object.getOwnPropertyNames(instance),
          });
      `;
      const bodyKuery = transpileValaaScriptTestBody(bodyText);
      const names = entities().creator.do(bodyKuery);
      expect(names.propertiesNames.sort()).toEqual(["a", "b", "d"]);
      expect(names.entityNames.sort()).toEqual(["a", "b", "d"]);
      expect(names.overriddenPropertiesNames.sort()).toEqual(["a", "c"]);
      expect(names.instanceNames.sort()).toEqual(["a", "c"]);
    });
    it("Object.getOwnPropertySymbols", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, valaaScriptBlock);
      const bodyText = `
          const properties = { a: 1, b: 2, d: this };
          const entity = new Entity({ name: "entity", owner: this, properties });
          const overriddenProperties = Object.create(properties);
          Object.assign(overriddenProperties, { a: 3, c: 4 });
          const instance = new entity({ owner: this, properties: overriddenProperties });
          ({
            Valaa: Valaa,
            propertiesSymbols: Object.getOwnPropertySymbols(properties),
            entitySymbols: Object.getOwnPropertySymbols(entity),
            overriddenPropertiesSymbols: Object.getOwnPropertySymbols(overriddenProperties),
            instanceSymbols: Object.getOwnPropertySymbols(instance),
          });
      `;
      const bodyKuery = transpileValaaScriptTestBody(bodyText);
      const symbols = entities().creator.do(bodyKuery);
      const Valaa = symbols.Valaa;
      const symbolSorter = (left, right) =>
          (left.toString() < right.toString() ? -1 : left.toString() > right.toString() ? 1 : 0);
      expect(symbols.propertiesSymbols.sort(symbolSorter)).toEqual([]);
      expect(symbols.entitySymbols.sort(symbolSorter)).toEqual([
        Valaa.name, Valaa.Resource.owner, Valaa.Scope.properties, Valaa.TransientFields.instances,
      ]);
      expect(symbols.overriddenPropertiesSymbols.sort(symbolSorter)).toEqual([]);
      expect(symbols.instanceSymbols.sort(symbolSorter)).toEqual([
        Valaa.Resource.ghostOwnlings, Valaa.Resource.owner, Valaa.Scope.properties, Valaa.prototype,
      ]);
    });
    it("Object.defineProperty", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, valaaScriptBlock);
      const bodyText = `
          const properties = { a: 1, b: 2, d: this };
          const entity = new Entity({ name: "entity", owner: this, properties });

          Object.defineProperty(entity, "a_plus_b",
              { get: function () { return this.a + this.b; } });

          const three = entity.a_plus_b;
          entity.a = 10;
          const twelve = entity.a_plus_b;
          const scopeValue = { number: 20 };

          Object.defineProperty(entity, "scope_plus_b",
              { get: function () { return scopeValue.number + this.b; } });

          const twentytwo = entity.scope_plus_b;
          scopeValue.number = 40;
          const still22 = entity.scope_plus_b;

          Object.defineProperty(entity, "lots",
              { get: function () { return this.a + entity.a + scopeValue.number; } });

          const lots = entity.lots;
          ({
            three: three,
            twelve: twelve,
            twentytwo: twentytwo,
            still22: still22,
            lots: lots,
          });
      `;
      const bodyKuery = transpileValaaScriptTestBody(bodyText);
      const { three, twelve, twentytwo, still22, lots } = entities().creator.do(bodyKuery);
      expect(three).toEqual(3);
      expect(twelve).toEqual(12);
      expect(twentytwo).toEqual(22);
      expect(still22).toEqual(22);
      expect(lots).toEqual(60);
    });

    it("duplicates an entity with ValaaScript function", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true });
      const bodyText = `
          () => {
            const owner = new Entity({ owner: this });
            const orig = new Entity({
              name: "origame", owner, properties: { first: 1, second: 2 },
            });
            const dup = orig.$V.duplicate();
            orig.first = 11;
            dup.second = -2;
            dup.third = -3;
            orig.fourth = 4;
            return {
              owner,
              orig, origProps: Object.assign({}, orig),
              dup, dupProps: Object.assign({}, dup),
            };
          }
      `;
      const bodyKuery = transpileValaaScriptTestBody(bodyText);
      const { owner, orig, origProps, dup, dupProps } = entities().test.do(bodyKuery, {})();
      expect(origProps)
          .toEqual({ first: 11, second: 2, fourth: 4 });
      expect(dupProps)
          .toEqual({ first: 1, second: -2, third: -3 });
      expect(owner.get("owner").getRawId())
          .toBe(entities().test.getRawId());
      expect(orig.get("owner").getRawId())
          .toBe(owner.getRawId());
      expect(dup.get("owner").getRawId())
          .toBe(owner.getRawId());
      expect(entities().test.get("unnamedOwnlings").length)
          .toEqual(4);
    });
  });
});

describe("Bug 0000090 tests", () => {
  it("creates an entity and stores it in to a variable with ValaaScript function", () => {
    harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true });
    const bodyText = `
      () => new Entity({ name: "uusime", owner: this });
    `;
    const bodyKuery = transpileValaaScriptTestBody(bodyText);
    const entityCreator = entities().test.do(bodyKuery);
    expect(entities().test.get("unnamedOwnlings").length)
        .toEqual(3);
    const newEntity = entityCreator();
    expect(newEntity.get("owner").getRawId())
        .toBe(entities().test.getRawId());
    expect(entities().test.get("unnamedOwnlings").length)
        .toEqual(4);
  });


  it("instantiates an entity and sets it in a variable with ValaaScript function", () => {
    harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true });
    const bodyText = `
      () => new this.pointer_to_ownling({ name: "uusime", owner: this });
    `;
    const bodyKuery = transpileValaaScriptTestBody(bodyText);
    const instantiator = entities().creator.do(bodyKuery);
    expect(entities().creator.get("unnamedOwnlings").length)
        .toEqual(0);
    const newEntity = instantiator();
    expect(newEntity.get("owner").getRawId())
        .toBe(entities().creator.getRawId());
    expect(entities().creator.get("unnamedOwnlings").length)
        .toEqual(1);
  });

  it("creates an entity with ValaaScript function", () => {
    harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true });
    const bodyText = `
      () => new Entity({ name: "uusime", owner: this });
    `;
    const bodyKuery = transpileValaaScriptTestBody(bodyText);
    const entityCreator = entities().test.do(bodyKuery);
    expect(entities().test.get("unnamedOwnlings").length)
        .toEqual(3);
    const newEntity = entityCreator();
    expect(newEntity.get("owner").getRawId())
        .toBe(entities().test.getRawId());
    expect(entities().test.get("unnamedOwnlings").length)
        .toEqual(4);
  });
});
