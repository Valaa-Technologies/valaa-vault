/* global describe expect it */

import { created } from "~/raem/events";
import { vRef } from "~/raem/VRL";
import { qualifiedSymbol } from "~/tools/namespace";

import { valueExpression, transpileValoscriptBody } from "~/script";

import { createEngineTestHarness } from "~/engine/test/EngineTestHarness";
import VALEK from "~/engine/VALEK";

const valoscriptBlock = [
  created({ id: ["creator-myStatement"], typeName: "Entity", initialState: {
    name: "myStatement", owner: vRef("creator"),
  }, }),
  created({ id: ["creator-myFunction"], typeName: "Entity", initialState: {
    name: "myFunction", owner: vRef("creator"),
  }, }),
  created({ id: ["creator-pointerTo-myStatement"], typeName: "Property", initialState: {
    name: "toMyStatement", owner: vRef("creator", "properties"),
    value: valueExpression(vRef("creator-myStatement")),
  }, }),
  created({ id: ["creator-pointerTo-myFunction"], typeName: "Property", initialState: {
    name: "toMyFunction", owner: vRef("creator", "properties"),
    value: valueExpression(vRef("creator-myFunction")),
  }, }),
];

let harness: { createds: Object, engine: Object, sourcerer: Object, testEntities: Object };
afterEach(() => { harness = null; }); // eslint-disable-line no-undef

const entities = () => harness.createds.Entity;
// const properties = () => harness.createds.Property;
// const relations = () => harness.createds.Relation;

function transpileValoscriptTestBody (bodyText: string, mediaName: ?string = "test media") {
  return transpileValoscriptBody(bodyText, { customVALK: VALEK, sourceInfo: {
    chronicleName: "", mediaName, source: bodyText,
    phaseBase: `'${mediaName}' as application/valoscript`,
    phase: "test valoscript transpilation", sourceMap: new Map(),
  } });
}

describe("scheme valosheath", () => {
  it("scope valos.<Type>.getRelations", () => {
    harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, valoscriptBlock);
    const bodyText = `
        new Entity({ name: "myEntity", owner: this, properties: { foo: 10 } });
    `;
    const bodyKuery = transpileValoscriptTestBody(bodyText);
    const myEntity = entities().creator.do(bodyKuery);
    const scope = myEntity.getValospaceScope().valos;
    const relatableGetRelationsSymbol = scope.Relatable.getRelations;
    expect(relatableGetRelationsSymbol)
        .toBeTruthy();
    expect(relatableGetRelationsSymbol)
        .toEqual(myEntity.getValospaceScope().valos.Entity.getRelations);
    const prototypeGetRelations = scope.Entity.prototype[relatableGetRelationsSymbol];
    expect(prototypeGetRelations)
        .toBeTruthy();
  });
  it("scope valos.Relation.target", () => {
    harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, valoscriptBlock);
    const bodyText = `
        new Relation({ name: "myEntity", owner: this, properties: { foo: 10 } });
    `;
    const bodyKuery = transpileValoscriptTestBody(bodyText);
    const myEntity = entities().creator.do(bodyKuery);
    const scope = myEntity.getValospaceScope().valos;
    const relationTarget = scope.Relation.target;
    expect(relationTarget)
        .toBeTruthy();
  });
});

describe("Creating and instancing with 'new' keyword", () => {
  it("creates with 'new' a new Entity", () => {
    harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, valoscriptBlock);
    const bodyText = `
        new Entity({ name: "myEntity", owner: this, properties: { foo: 10 } });
    `;
    const bodyKuery = transpileValoscriptTestBody(bodyText);
    const myEntity = entities().creator.do(bodyKuery);
    expect(myEntity.step("name"))
        .toEqual("myEntity");
    expect(myEntity.step(VALEK.propertyLiteral("foo")))
        .toEqual(10);
    expect(entities().creator.step(
            VALEK.to("unnamedOwnlings").filter(VALEK.hasName("myEntity")).to(0)))
        .toEqual(myEntity);
  });
  it("adds with 'new' a child Relation to an existing Entity", () => {
    harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, valoscriptBlock);
    const bodyText = `
        const parent = new Entity({ name: "parent", owner: this,
            properties: { position: { x: 10, y: 20 } } });
        new Relation({ name: "myRelation", owner: parent,
            properties: { position: { x: 1, y: 2 } } });
    `;
    const bodyKuery = transpileValoscriptTestBody(bodyText);
    const myRelation = entities().creator.do(bodyKuery);
    expect(myRelation.step("name"))
        .toEqual("myRelation");
    expect(myRelation.step(VALEK.propertyLiteral("position")))
        .toEqual({ x: 1, y: 2 });
    const MyTypeEntity = myRelation.step("owner");
    expect(MyTypeEntity.step("name"))
        .toEqual("parent");
    expect(MyTypeEntity.step(VALEK.relations("myRelation").to(0)))
        .toEqual(myRelation);
  });
  it("adds with 'new' a structured sub-Relation to an existing Entity", () => {
    harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, valoscriptBlock);
    const bodyText = `
        const parent = new Entity({ name: "parent", owner: this,
            properties: { position: { x: 10, y: 20 } } });
        const ret = parent.$V.getSubResource(["@-:rel:1@@"]);
        new Relation({
          name: "myRelation",
          owner: parent, subResource: ["@-:rel:1@@"],
          properties: { position: { x: 1, y: 2 } },
        });
        ret;
    `;
    const bodyKuery = transpileValoscriptTestBody(bodyText);
    const myRelation = entities().creator.do(bodyKuery);
    expect(myRelation.step("name"))
        .toEqual("myRelation");
    expect(myRelation.step(VALEK.propertyLiteral("position")))
        .toEqual({ x: 1, y: 2 });
    const MyTypeEntity = myRelation.step("owner");
    expect(MyTypeEntity.step("name"))
        .toEqual("parent");
    expect(MyTypeEntity.step(VALEK.relations("myRelation").to(0)))
        .toEqual(myRelation);
  });
  it("construct sub-resources with obtainSubResource", () => {
    harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, valoscriptBlock);
    const [subEnt, nuuEnt, subRel1, subRel2] = entities().creator.doValoscript(`
        const ToThing = new Relation({ name: "ToThing", owner: this,
          properties: { position: { x: 10, y: 20 } }
        });
        const parent = new Entity({ name: "parent", owner: this });
        const subEnt = new Entity({ owner: parent, subResource: ["@*$foo.existing@@"] });
        const primer = (initialState, section, index) => {
          if (index === 2) {
            initialState.instancePrototype = ToThing;
            if (section[1][1] === 2) {
              initialState.properties.position = { x: 1, y: 2 };
            }
          }
        };
        const relInst1 = parent.$V.obtainSubResource(
            ["@*$foo.existing@*$foo.nuu@-$foo.toThings$d.1@@"], primer);
        const relInst2 = parent.$V.obtainSubResource(
            [["@*", $\`foo:existing\`], ["@*", $\`foo:nuu\`], ["@-", $\`foo:toThings\`, 2]],
            primer);
        [subEnt, subEnt[$\`foo:nuu\`], relInst1, relInst2];
    `, { console });
    expect(subEnt.propertyValue(qualifiedSymbol("foo", "nuu")))
        .toEqual(nuuEnt);
    expect(subEnt.propertyValue("@$foo.nuu@@"))
        .toEqual(nuuEnt);
    expect(subRel1.step("name"))
        .toEqual("@$foo.toThings@@");
    expect(subRel1.step(VALEK.propertyLiteral("position")))
        .toEqual({ x: 10, y: 20 });
    expect(subRel2.step(VALEK.propertyLiteral("position")))
        .toEqual({ x: 1, y: 2 });
    expect(subRel1.step("owner"))
        .toEqual(nuuEnt);
    expect(subRel2.step("owner"))
        .toEqual(nuuEnt);
    expect(nuuEnt.step(VALEK.relations(qualifiedSymbol("foo", "toThings"))))
        .toEqual([subRel1, subRel2]);
  });

  it("modifies existing Entity property", () => {
    harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, valoscriptBlock);
    const bodyText = `
        const parent = new Entity({ name: "parent", owner: this,
            properties: { position: { x: 10, y: 20 } } });
        [parent, parent.position = { x: 11, y: 22 }];
    `;
    const bodyKuery = transpileValoscriptTestBody(bodyText);
    const [parent, position] = entities().creator.do(bodyKuery);
    expect(position)
        .toEqual({ x: 11, y: 22 });
    expect(parent.step(VALEK.propertyLiteral("position")))
        .toEqual({ x: 11, y: 22 });
  });
  it("instantiates with 'new' an Entity which has ownlings", () => {
    harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, valoscriptBlock);
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
    const bodyKuery = transpileValoscriptTestBody(bodyText);

    const instance = entities().creator.do(bodyKuery);

    expect(instance.step("name"))
        .toEqual("instance");
    expect(instance.step(VALEK.propertyLiteral("position")))
        .toEqual({ x: 100, y: 200 });

    const MyTypeEntity = instance.step("prototype");
    expect(MyTypeEntity.step("name"))
        .toEqual("MyType");
    expect(MyTypeEntity.step(VALEK.to("instances").to(0)))
        .toEqual(instance);
    expect(MyTypeEntity.step(VALEK.propertyLiteral("position")))
        .toEqual({ x: 11, y: 22 });

    const MyTypeRelation = MyTypeEntity.step(VALEK.relations("myTypeRelation").to(0));
    expect(MyTypeRelation.step("name"))
        .toEqual("myTypeRelation");
    expect(MyTypeRelation.step(VALEK.propertyLiteral("orientation")))
        .toEqual({ a: 90 });
    expect(MyTypeRelation.step(VALEK.to("target").propertyLiteral("payload")))
        .toEqual("data");

    const instanceRelation = instance.step(VALEK.relations("myTypeRelation").to(0));
    expect(instanceRelation.step("name"))
        .toEqual("myTypeRelation");
    expect(instanceRelation.step(VALEK.propertyLiteral("orientation")))
        .toEqual({ a: 180 });
    expect(instanceRelation.step(VALEK.to("target").propertyLiteral("payload")))
        .toEqual("data");
    expect(MyTypeRelation.step(VALEK.to("target").propertyLiteral("secondPayload")))
        .toEqual("more data");
    expect(instanceRelation.step(VALEK.to("target").propertyLiteral("secondPayload")))
        .toEqual("more data");
  });
  it("returns the result of an expression with properties correctly", () => {
    harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, valoscriptBlock);
    const bodyText = `
        const entity = new Entity({ name: "theEntity", owner: this,
            properties: { numbers: { a: 1, b: 2 } } });
        entity.numbers.a + entity.numbers.b;
    `;
    const bodyKuery = transpileValoscriptTestBody(bodyText);
    const number = entities().creator.do(bodyKuery);
    expect(number).toEqual(3);
  });
  it("accesses array values using a number for index correctly", () => {
    harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, valoscriptBlock);
    const bodyText = `
        const values = [3,4,5,6,7,8];
        values[3];
    `;
    const bodyKuery = transpileValoscriptTestBody(bodyText);
    const number = entities().creator.do(bodyKuery);
    expect(number).toEqual(6);
  });
  it("accesses array values using an expression with properties correctly", () => {
    harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, valoscriptBlock);
    const bodyText = `
        const entity = new Entity({ name: "theEntity", owner: this,
            properties: { numbers: { a: 1, b: 2 } } });
        const values = [3,4,5,6,7,8];
        [entity.numbers.a + entity.numbers.b, values[entity.numbers.a + entity.numbers.b]];
    `;
    const bodyKuery = transpileValoscriptTestBody(bodyText);
    const [index, result] = entities().creator.do(bodyKuery);
    expect(index).toEqual(3);
    expect(result).toEqual(6);
  });
  it("Accesses properties inside a function correctly", () => {
    harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, valoscriptBlock);
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
    const bodyKuery = transpileValoscriptTestBody(bodyText);
    const number = entities().creator.do(bodyKuery);
    expect(number).toEqual(4444);
  });
  it("Handles 'this' accessor in arrow functions correctly", () => {
    harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, valoscriptBlock);
    const bodyText = `
        this.a = 1;
        this.b = 2;
        const f = () => 400 + g(this.a + 1, this.b);
        const g = (a, b) => 40 + a + b;
        4000 + f();
    `;
    const bodyKuery = transpileValoscriptTestBody(bodyText);
    const number = entities().creator.do(bodyKuery);
    expect(number).toEqual(4444);
  });
  it("Accesses to non-declared properties in a transient Entity resolves to undefined", () => {
    harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, valoscriptBlock);
    const bodyText = `
        function functionA () {
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
    const bodyKuery = transpileValoscriptTestBody(bodyText);
    const result = entities().creator.do(bodyKuery);
    expect(result).toEqual("ok");
  });
});

describe("Object.* decorator tests", () => {
  it("handles Object.assign roundtrip from native object to ValOS resource and back", () => {
    harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, valoscriptBlock);
    const bodyText = `
        const target = new Entity({ owner: this });
        const properties = { a: 1, target: target };
        const midway = new Entity({ owner: this });
        Object.assign(midway, properties);
        const result = Object.assign({}, midway);
        [target, properties, midway, result];
    `;
    const bodyKuery = transpileValoscriptTestBody(bodyText);
    const [target, properties, midway, result] = entities().creator.do(bodyKuery);
    expect(properties).toEqual({ a: 1, target });
    expect(harness.engine.run(midway, ["§..", "a"])).toEqual(1);
    expect(harness.engine.run(midway, ["§..", "target"])).toEqual(target);
    expect(result).toEqual({ a: 1, target });
    expect(result).not.toBe(properties);
  });
  it("handles more complex Object.assign between native and ValOS resources", () => {
    harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, valoscriptBlock);
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
    const bodyKuery = transpileValoscriptTestBody(bodyText);
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
    harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, valoscriptBlock);
    const bodyText = `
        const properties = { a: 1, b: 2, c: 3, d: 4 };
        const propertiesTotal = Object.keys(properties).reduce((t, v) => t + properties[v], 0);
        const entity = new Entity({ name: "entity", owner: this, properties });
        const total = Object.keys(entity).reduce((t, v) => t + entity[v], 0);
        [propertiesTotal, total];
    `;
    const bodyKuery = transpileValoscriptTestBody(bodyText);
    const [propertiesTotal, number] = entities().creator.do(bodyKuery);
    expect(propertiesTotal).toEqual(1 + 2 + 3 + 4);
    expect(number).toEqual(1 + 2 + 3 + 4);
  });
  it("Sums the values of all properties in an entity using Object.values", () => {
    harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, valoscriptBlock);
    const bodyText = `
        const properties = { a: 2, b: 3, c: 4, d: 5 };
        const propertiesTotal = Object.values(properties).reduce((t, v) => t + v, 0);
        const entity = new Entity({ name: "entity", owner: this, properties });
        const total = Object.values(entity).reduce((t, v) => t + v, 0);
        [propertiesTotal, total];
    `;
    const bodyKuery = transpileValoscriptTestBody(bodyText);
    const [propertiesTotal, number] = entities().creator.do(bodyKuery);
    expect(propertiesTotal).toEqual(2 + 3 + 4 + 5);
    expect(number).toEqual(2 + 3 + 4 + 5);
  });
  it("Sums the values of all properties in an entity using Object.entries", () => {
    harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, valoscriptBlock);
    const bodyText = `
        const properties = { a: 3, b: 4, c: 5, d: 6 };
        const propertiesTotal = Object.entries(properties).reduce(
            (t, v) => [((t[0][v[0]] = -v[1]), t[0]), t[1] + v[1]], [{}, 0]);
        const entity = new Entity({ name: "entity", owner: this, properties });
        const total = Object.entries(entity).reduce(
            (t, v) => [((t[0][v[0]] = -v[1]), t[0]), t[1] + v[1]], [{}, 0]);
        [propertiesTotal, total];
    `;
    const bodyKuery = transpileValoscriptTestBody(bodyText);
    const [[propertiesInverseObject, propertiesTotal], [entityInverseObject, total]] =
        entities().creator.do(bodyKuery);
    expect(propertiesInverseObject).toEqual({ a: -3, b: -4, c: -5, d: -6 });
    expect(propertiesTotal).toEqual(3 + 4 + 5 + 6);
    expect(entityInverseObject).toEqual({ a: -3, b: -4, c: -5, d: -6 });
    expect(total).toEqual(3 + 4 + 5 + 6);
  });
  it("Object.getOwnPropertyDescriptor", () => {
    harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, valoscriptBlock);
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
          entityId: Object.getOwnPropertyDescriptor(entity, valos.Resource.id),
          entityOwner: Object.getOwnPropertyDescriptor(entity, valos.Resource.owner),
          entityName: Object.getOwnPropertyDescriptor(entity, valos.name),
          entityA: Object.getOwnPropertyDescriptor(entity, "a"),
          entityB: Object.getOwnPropertyDescriptor(entity, "b"),
          entityC: Object.getOwnPropertyDescriptor(entity, "c"),
          entityD: Object.getOwnPropertyDescriptor(entity, "d"),
          overriddenPropertyA: Object.getOwnPropertyDescriptor(overriddenProperties, "a"),
          overriddenPropertyB: Object.getOwnPropertyDescriptor(overriddenProperties, "b"),
          overriddenPropertyC: Object.getOwnPropertyDescriptor(overriddenProperties, "c"),
          overriddenPropertyD: Object.getOwnPropertyDescriptor(overriddenProperties, "d"),
          instanceId: Object.getOwnPropertyDescriptor(instance, valos.Resource.id),
          instanceOwner: Object.getOwnPropertyDescriptor(instance, valos.Resource.owner),
          instanceName: Object.getOwnPropertyDescriptor(instance, valos.name),
          instanceA: Object.getOwnPropertyDescriptor(instance, "a"),
          instanceB: Object.getOwnPropertyDescriptor(instance, "b"),
          instanceC: Object.getOwnPropertyDescriptor(instance, "c"),
          instanceD: Object.getOwnPropertyDescriptor(instance, "d"),
        });
    `;
    const bodyKuery = transpileValoscriptTestBody(bodyText);

    const descriptors = entities().creator.do(bodyKuery);
    function objectPropertyDescriptor (value: any, object: ?Object = {}) {
      return {
        value,
        writable: true, enumerable: true, configurable: true,
        ...object,
      };
    }
    function resourcePropertyDescriptor (value: any, object: ?Object = {}) {
      return {
        value, valos: true, property: true, persisted: true,
        writable: true, enumerable: true, configurable: true,
        ...object,
      };
    }
    function hostFieldDescriptor (value: any, object: ?Object = {}) {
      return {
        value, valos: true, host: true, persisted: true,
        writable: true, enumerable: false, configurable: false,
        ...object,
      };
    }
    expect(descriptors.propertyA).toMatchObject(objectPropertyDescriptor(1));
    expect(descriptors.propertyB).toMatchObject(objectPropertyDescriptor(2));
    expect(descriptors.propertyC).toEqual(undefined);
    expect(descriptors.propertyD.value).toBe(entities().creator);
    expect(descriptors.entityId).toEqual(undefined);
        // .toMatchObject(hostFieldDescriptor(undefined,
        //     { name: "id", persisted: undefined, writable: undefined }));
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
        // .toMatchObject(hostFieldDescriptor(undefined,
        //     { name: "id", persisted: undefined, writable: undefined }));
    expect(descriptors.instanceOwner.value).toBe(entities().creator);
    expect(descriptors.instanceName).toEqual(undefined);
    expect(descriptors.instanceA).toMatchObject(resourcePropertyDescriptor(3));
    expect(descriptors.instanceB).toEqual(undefined);
    expect(descriptors.instanceC).toMatchObject(resourcePropertyDescriptor(4));
    expect(descriptors.instanceD).toEqual(undefined);
  });
  it("Object.getOwnPropertyNames", () => {
    harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, valoscriptBlock);
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
    const bodyKuery = transpileValoscriptTestBody(bodyText);
    const names = entities().creator.do(bodyKuery);
    expect(names.propertiesNames.sort()).toEqual(["a", "b", "d"]);
    expect(names.entityNames.sort()).toEqual(["a", "b", "d"]);
    expect(names.overriddenPropertiesNames.sort()).toEqual(["a", "c"]);
    expect(names.instanceNames.sort()).toEqual(["a", "c"]);
  });
  it("Object.getOwnPropertySymbols", () => {
    harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, valoscriptBlock);
    const bodyText = `
        const properties = { a: 1, b: 2, c: 3, d: this };
        const Base = new Entity({ name: "entity", owner: this, properties });
        const overriddenProperties = Object.create(properties);
        Object.assign(overriddenProperties, { c: 33, e: 4 });
        --overriddenProperties.b;
        --overriddenProperties.c;
        const instance = new Base({ owner: this, properties: overriddenProperties });
        ({
          valos, instance,
          b: instance.b,
          c: instance.c,
          propertiesSymbols: Object.getOwnPropertySymbols(properties),
          entitySymbols: Object.getOwnPropertySymbols(Base),
          overriddenPropertiesSymbols: Object.getOwnPropertySymbols(overriddenProperties),
          instanceSymbols: Object.getOwnPropertySymbols(instance),
        });
    `;
    const bodyKuery = transpileValoscriptTestBody(bodyText);
    const { valos, instance, b, c, ...rest } = entities().creator.do(bodyKuery);
    expect(b).toEqual(1);
    expect(c).toEqual(32);
    const symbolSorter = (left, right) =>
        (left.toString() < right.toString() ? -1 : left.toString() > right.toString() ? 1 : 0);
    expect(rest.propertiesSymbols.sort(symbolSorter)).toEqual([]);
    expect(rest.entitySymbols.sort(symbolSorter)).toEqual([
      valos.TransientFields.instances, valos.nameAlias, valos.Resource.owner,
      valos.Scope.properties,
    ]);
    expect(rest.overriddenPropertiesSymbols.sort(symbolSorter)).toEqual([]);
    expect(rest.instanceSymbols.sort(symbolSorter)).toEqual([
      valos.TransientFields.ghostOwnlings, valos.Resource.owner, valos.Scope.properties,
      valos.prototypeAlias,
    ]);
  });
  it("Object.defineProperty", () => {
    harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, valoscriptBlock);
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
    const bodyKuery = transpileValoscriptTestBody(bodyText);
    const { three, twelve, twentytwo, still22, lots } = entities().creator.do(bodyKuery);
    expect(three).toEqual(3);
    expect(twelve).toEqual(12);
    expect(twentytwo).toEqual(22);
    expect(still22).toEqual(22);
    expect(lots).toEqual(60);
  });

  it("duplicates an entity with valoscript function", () => {
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
    const bodyKuery = transpileValoscriptTestBody(bodyText);
    const { owner, orig, origProps, dup, dupProps } = entities().test.do(bodyKuery, {})();
    expect(origProps)
        .toEqual({ first: 11, second: 2, fourth: 4 });
    expect(dupProps)
        .toEqual({ first: 1, second: -2, third: -3 });
    expect(owner.step("owner").getRawId())
        .toBe(entities().test.getRawId());
    expect(orig.step("owner").getRawId())
        .toBe(owner.getRawId());
    expect(dup.step("owner").getRawId())
        .toBe(owner.getRawId());
    expect(entities().test.step("unnamedOwnlings").length)
        .toEqual(4);
  });
});

describe("namespaced resource $V.names", () => {
  it("creates a new Entity with a namespaced name and property", () => {
    harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, valoscriptBlock);
    const bodyText = `
        new Entity({ name: $ns1.myEntity, owner: this, properties: { [$ns2.foo]: 10 } });
    `;
    const bodyKuery = transpileValoscriptTestBody(bodyText);
    const myEntity = entities().creator.do(bodyKuery);
    expect(myEntity.step("name"))
        .toEqual("@$ns1.myEntity@@");
    expect(myEntity.step("prefix"))
        .toEqual("ns1");
    expect(myEntity.step("localPart"))
        .toEqual("myEntity");
    expect(myEntity.getPropertyResource(qualifiedSymbol("ns2", "foo")).getRawId())
        .toMatch(/@\.\$ns2\.foo@@/);
    expect(myEntity.step(VALEK.propertyLiteral("@$ns2.foo@@")))
        .toEqual(10);
    expect(myEntity.propertyValue(qualifiedSymbol("ns2", "foo")))
        .toEqual(10);
    expect(entities().creator.step(
            VALEK.to("unnamedOwnlings").filter(VALEK.hasName("@$ns1.myEntity@@")).to(0)))
        .toEqual(myEntity);
  });
  it("handles Object.assign roundtrip from native object to ValOS resource and back", () => {
    harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, valoscriptBlock);
    const bodyText = `
        const properties = { a: 1, [$V.name]: "newname", [$nss.foo]: "propfoo" };
        const Base = new Entity({
          owner: this, name: "basename",
          properties: { [$nss.foo]: "nssfoo", [$base.foo]: "basefoo" },
        });
        const midway = new Base({ owner: this });
        Object.assign(midway, properties);
        const plain = Object.assign({}, midway);
        const target = new Entity({ owner: this, name: "oldname", [$nss.foo]: "targetfoo" });
        Object.assign(target, midway);
        [properties, Base, midway, plain, target];
    `;
    const bodyKuery = transpileValoscriptTestBody(bodyText);
    const [properties, Base, midway, plain, target] = entities().creator.do(bodyKuery);
    const BaseFooTag = qualifiedSymbol("base", "foo");
    const NSSFooTag = qualifiedSymbol("nss", "foo");
    expect(properties).toMatchObject({
      a: 1, [qualifiedSymbol("V", "name")]: "newname", [NSSFooTag]: "propfoo",
    });
    expect(Base.propertyValue(qualifiedSymbol("V", "name"))).toEqual("basename");
    expect(midway.step("name")).toEqual("newname");
    expect(midway.propertyValue(qualifiedSymbol("V", "name"))).toEqual("newname");
    expect(midway.propertyValue("a")).toEqual(1);
    expect(midway.propertyValue(BaseFooTag)).toEqual("basefoo");
    expect(midway.propertyValue(NSSFooTag)).toEqual("propfoo");
    expect(plain).toEqual({ a: 1, "@$base.foo@@": "basefoo", "@$nss.foo@@": "propfoo" });
    expect(plain).not.toBe(properties);
    // native fields not assigned (?)
    expect(target.step("name")).toEqual("oldname");
    expect(target.propertyValue(qualifiedSymbol("V", "name"))).toEqual("oldname");
    expect(target.propertyValue("a")).toEqual(1);
    expect(target.propertyValue(BaseFooTag)).toEqual("basefoo");
    expect(target.propertyValue(NSSFooTag)).toEqual("propfoo");
  });
  it("matches namespaced symbol Relation names", () => {
    harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, valoscriptBlock);
    const bodyText = `
        new Relation({ name: $ns1.myRelation1, source: this, properties: { [$prop.foo]: 10 } });
        new Relation({ name: $ns1.myRelation2, source: this, properties: { [$prop.foo]: 11 } });
        new Relation({ name: $ns2.myRelation1, source: this, properties: { [$prop.foo]: 12 } });
        new Relation({ name: $ns2.myRelation2, source: this, properties: { [$prop.foo]: 13 } });
        new Relation({ name: $ns1.myRelation1, source: this, properties: { [$prop.foo]: 14 } });
        new Relation({ name: $ns1.myRelation2, source: this, properties: { [$prop.foo]: 15 } });
        new Relation({ name: $ns2.myRelation1, source: this, properties: { [$prop.foo]: 16 } });
        new Relation({ name: $ns2.myRelation2, source: this, properties: { [$prop.foo]: 17 } });
        [
          this.$V.getRelations($ns1.myRelation1),
          this.$V.getRelations($ns1.myRelation2),
          this.$V.getRelations("@$ns2.myRelation1@@"),
          this.$V.getRelations("@$ns2.myRelation2@@"),
        ];
    `;
    const bodyKuery = transpileValoscriptTestBody(bodyText);
    const [ns1r1, ns1r2, ns2r1, ns2r2] = entities().creator.do(bodyKuery);
    expect(ns1r1.length).toEqual(2);
    expect(ns1r2.length).toEqual(2);
    expect(ns2r1.length).toEqual(2);
    expect(ns2r2.length).toEqual(2);
    expect(ns1r1.map(r => r.propertyValue(qualifiedSymbol("prop", "foo")))).toEqual([10, 14]);
    expect(ns1r2.map(r => r.propertyValue(qualifiedSymbol("prop", "foo")))).toEqual([11, 15]);
    expect(ns2r1.map(r => r.propertyValue("@$prop.foo@@"))).toEqual([12, 16]);
    expect(ns2r2.map(r => r.propertyValue("@$prop.foo@@"))).toEqual([13, 17]);
  });
  it("getFickleId returns a fickle id which returns original entity with valos.fickleRefer", () => {
    harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true });
    const { entity, fickleId, fickleEntity } = entities().creator.doValoscript(`
      const entity = new Entity({ name: "fickl", owner: this });
      const fickleId = entity.$V.getFickleId(5);
      ({ entity, fickleId, fickleEntity: valos.fickleRefer(fickleId) });
    `);
    expect(fickleId.length >= 5)
        .toEqual(true);
    expect(String(entity))
        .toEqual(String(fickleEntity));
  });
});

describe("Bug 0000090 tests", () => {
  it("creates an entity and stores it in to a variable with valoscript function", () => {
    harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true });
    const bodyText = `
      () => new Entity({ name: "uusime", owner: this });
    `;
    const bodyKuery = transpileValoscriptTestBody(bodyText);
    const entityCreator = entities().test.do(bodyKuery);
    expect(entities().test.step("unnamedOwnlings").length)
        .toEqual(3);
    const newEntity = entityCreator();
    expect(newEntity.step("owner").getRawId())
        .toBe(entities().test.getRawId());
    expect(entities().test.step("unnamedOwnlings").length)
        .toEqual(4);
  });


  it("instantiates an entity and sets it in a variable with valoscript function", () => {
    harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true });
    const bodyText = `
      () => new this.pointer_to_ownling({ name: "uusime", owner: this });
    `;
    const bodyKuery = transpileValoscriptTestBody(bodyText);
    const instantiator = entities().creator.do(bodyKuery);
    expect(entities().creator.step("unnamedOwnlings").length)
        .toEqual(0);
    const newEntity = instantiator();
    expect(newEntity.step("owner").getRawId())
        .toBe(entities().creator.getRawId());
    expect(entities().creator.step("unnamedOwnlings").length)
        .toEqual(1);
  });

  it("creates an entity with valoscript function", () => {
    harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true });
    const bodyText = `
      () => new Entity({ name: "uusime", owner: this });
    `;
    const bodyKuery = transpileValoscriptTestBody(bodyText);
    const entityCreator = entities().test.do(bodyKuery);
    expect(entities().test.step("unnamedOwnlings").length)
        .toEqual(3);
    const newEntity = entityCreator();
    expect(newEntity.step("owner").getRawId())
        .toBe(entities().test.getRawId());
    expect(entities().test.step("unnamedOwnlings").length)
        .toEqual(4);
  });
});
