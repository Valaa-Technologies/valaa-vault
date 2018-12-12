/* global jest describe expect beforeEach it */

import { created } from "~/raem/events";
import { vRef } from "~/raem/ValaaReference";

import { evaluateTestProgram } from "~/script/test/ScriptTestHarness";
import { transpileValaaScriptBody } from "~/script";
import { createNativeIdentifier, getNativeIdentifierValue }
    from "~/script/denormalized/nativeIdentifier";
import VALSK, { Kuery, literal, pointer } from "~/script/VALSK";

const createBlockA = [
  created({ id: ["A_parent"], typeName: "TestScriptyThing" }),
  created({ id: ["A_test"], typeName: "TestScriptyThing", initialState: {
    owner: vRef("A_parent", "children")
  }, }),
  created({ id: ["test-myFunc"], typeName: "Property", initialState: {
    name: "myFunc", owner: vRef("A_test", "properties"),
    value: literal(VALSK.doStatements(VALSK.apply(
        VALSK.fromScope("propertyCallback").notNull(), VALSK.fromScope("this"))).toJSON()),
  }, }),
  created({ id: ["test-age"], typeName: "Property", initialState: {
    name: "age", owner: vRef("A_test", "properties"),
    value: literal(35),
  }, }),
  created({ id: ["test-myParent"], typeName: "Property", initialState: {
    name: "myParent", owner: vRef("A_test", "properties"),
    value: pointer(vRef("A_parent")),
  }, }),
];

/**
 * Runs given programKuery from given head, with given scope, against corpus created with
 * the above createBlockA and given extracommandBlocks.
 */
function evaluateProgram (extracommandBlocks = [], head, programKuery: Kuery, scope: ?Object,
    options: Object = {}) {
  return evaluateTestProgram(
      [createBlockA, ...extracommandBlocks],
      head, programKuery, scope, options);
}

/**
 * parseValue should:
 * - convert javascript in to VAKON.
 * - not create any resources.
 * - return errors in a non-stupid way
 */
describe("ValaaScript", () => {
  describe("Property function calling with: 'this.myFunc()'", () => {
    const bodyKuery = transpileValaaScriptBody("this.myFunc()");

    it("calls native function stored in scope when valked with the scope as 'this'", () => {
      const scope = { myFunc: jest.fn() };

      evaluateProgram([], scope, bodyKuery, scope);
      expect(scope.myFunc.mock.calls.length).toBe(1);
      expect(scope.myFunc.mock.calls[0].length).toBe(0);
    });
  });

  describe("Creating scope variables", () => {
    it("sets the trivial 'var temp = 1' in scope as property thunk when valked", () => {
      const bodyKuery = transpileValaaScriptBody(`
          var temp = 1;
          temp;
      `);
      const scope = {};
      const { temp, closure } = evaluateProgram([], scope,
          bodyKuery.select({ temp: VALSK.head(), closure: VALSK.fromScope() }), scope);
      expect(temp)
          .toBe(1);
      expect(getNativeIdentifierValue(closure.temp))
          .toBe(1);
    });

    it("sets the complex 'var temp = this.age + diff * 2' in scope as property thunk", () => {
      const bodyText = `
          var temp = this.age + diff * 2;
          temp;
      `;
      const bodyKuery = transpileValaaScriptBody(bodyText);
      const head = { age: 35 };
      const scope = { diff: createNativeIdentifier(-5) };

      const temp = evaluateProgram([], head, bodyKuery, scope, { verbosity: 0 });
      expect(temp)
          .toBe(25);
    });

    it("sets the complex 'var temp = { field: this.myParent, ... }' in scope", () => {
      const bodyKuery = transpileValaaScriptBody(`
          var temp = {
            [0]: this.myParent,
            field1: "field1Value",
            "field2": "field2Value",
            ["field3"]: "field3Value",
          };
          temp;
      `);
      const head = { myParent: vRef("A_parent") };
      const scope = {};
      const harness = {};
      const temp = evaluateProgram([], head, bodyKuery, scope, { harness });
      expect(temp[0])
          .toBe(harness.run(vRef("A_parent"), "id"));
      expect(temp.field1)
          .toBe("field1Value");
      expect(temp.field2)
          .toBe("field2Value");
      expect(temp.field3)
          .toBe("field3Value");
    });
    it("sets generated key object 'var temp = { [key]: this.myParent }' in scope", () => {
      const bodyKuery = transpileValaaScriptBody(`
          var key = "field";
          var temp = {
            [key]: this.myParent,
            [this.fieldName]: "otherValue",
            key: 10,
          }
          temp;
      `);
      const head = { myParent: vRef("A_parent"), fieldName: "otherField" };
      const scope = {};
      const temp = evaluateProgram([], head, bodyKuery, scope);
      expect(temp)
          .toEqual({ key: 10, field: vRef("A_parent"), otherField: "otherValue" });
    });
  });

  describe("Manipulating existing variables", () => {
    it("assigns existing plain object scope variable with 'temp = this.age' when valked", () => {
      const bodyKuery = transpileValaaScriptBody(`
          temp = this.age;
      `);
      const head = { age: 35 };
      const scope = { temp: createNativeIdentifier(10) };

      const temp = evaluateProgram([], head, bodyKuery, scope, { verbosity: 0 });
      expect(temp)
          .toEqual(35);
      expect(getNativeIdentifierValue(scope.temp))
          .toEqual(35);
    });


    it("modifies scope variable with 'temp += this.age'", () => {
      const bodyKuery = transpileValaaScriptBody(`
          temp += this.age;
      `);
      const head = { age: 35 };
      const scope = { temp: createNativeIdentifier(10) };

      const temp = evaluateProgram([], head, bodyKuery, scope);
      expect(temp)
          .toEqual(45);
      expect(head.age)
          .toEqual(35);
      expect(getNativeIdentifierValue(scope.temp))
          .toEqual(45);
    });

    it("modifies this variable with 'this.age += 20'", () => {
      const bodyKuery = transpileValaaScriptBody(`
          this.age += 20;
          temp = this.age - 5;
      `);
      const head = { age: 35 };
      const scope = { temp: createNativeIdentifier(10) };

      const temp = evaluateProgram([], head, bodyKuery, scope, { verbosity: 0 });
      expect(temp)
          .toEqual(50);
      expect(head.age)
          .toEqual(55);
      expect(getNativeIdentifierValue(scope.temp))
          .toEqual(50);
    });
  });

  describe("Functions", () => {
    it("declares a trivial function and calls it", () => {
      const bodyKuery = transpileValaaScriptBody(`
          function returnMillion () { return 1000000; }
          returnMillion();
      `);
      expect(evaluateProgram([], {}, bodyKuery, {}, { verbosity: 0 }))
          .toEqual(1000000);
    });

    it("declares a function with normal and defaulted parameters and calls it", () => {
      const bodyKuery = transpileValaaScriptBody(`
          function funcWithParam (param) { return param + 20; }
          funcWithParam(100);
      `);
      expect(evaluateProgram([], {}, bodyKuery, {}, { verbosity: 0 }))
          .toEqual(120);
    });

    it("declares a function with defaulted parameters and calls it", () => {
      const bodyKuery = transpileValaaScriptBody(`
          function paramPlusDefaulted (defaulted = 10) { return defaulted + 5; }
          paramPlusDefaulted(30) + paramPlusDefaulted();
      `);
      expect(evaluateProgram([], {}, bodyKuery, {}, { verbosity: 0 }))
          .toEqual(50);
    });

    it("returns a lambda and closure variables", () => {
      const bodyKuery = transpileValaaScriptBody(`
          var varVar = 1;
          let letVar = 3;
          const constVar = 6;
          val => val + varVar + letVar + constVar
      `);
      expect(evaluateProgram([], {}, bodyKuery, {}, { verbosity: 0 })(1))
          .toEqual(11);
    });

    it("calls a lambda callback function through typeof", () => {
      const bodyKuery = transpileValaaScriptBody(`
          function callCallback (callbackOrValue) {
            return (typeof callbackOrValue === "function")
                ? callbackOrValue(10)
                : callbackOrValue;
          }
          callCallback(value => value + callCallback(12));
      `);
      expect(evaluateProgram([], {}, bodyKuery, {}, { verbosity: 0 }))
          .toEqual(22);
    });

    it("persists variables in a simple closure across calls", () => {
      const bodyKuery = transpileValaaScriptBody(`
          var value = 0;
          () => (value += 7);
      `);
      const callback = evaluateProgram([], {}, bodyKuery, {}, { verbosity: 0 });
      expect(callback())
          .toEqual(7);
      expect(callback())
          .toEqual(14);
    });

    it("persists variables in a complex closure across calls", () => {
      const bodyText = `
          var value = 0;
          function grabClosure () {
            value = 10;
            return () => (value -= 2);
          }
          [grabClosure, () => ++value];
      `;
      const bodyKuery = transpileValaaScriptBody(bodyText);
      const [grabClosure, incValue] = evaluateProgram([], {}, bodyKuery, {}, { verbosity: 0 });
      expect(incValue())
          .toEqual(1);
      const grabbedOnce = grabClosure();
      expect(incValue())
          .toEqual(11);
      expect(grabbedOnce())
          .toEqual(9);
      expect(grabClosure()())
          .toEqual(8);
    });

    it("forwards 'this' of a function to the program 'this' if not specified at call site", () => {
      const bodyText = `
          function accessThisField () {
            return this.myField += 11;
          }
          accessThisField;
      `;
      const bodyKuery = transpileValaaScriptBody(bodyText);
      const programThis = { myField: 0 };
      const accessMyField = evaluateProgram([], programThis, bodyKuery, {}, { verbosity: 0 });
      expect(accessMyField())
          .toEqual(11);
      expect(programThis.myField)
          .toEqual(11);
      const explicitThis = { myField: 2 };
      expect(accessMyField.call(explicitThis))
          .toEqual(13);
      expect(explicitThis.myField)
          .toEqual(13);
    });
    it("forwards 'this' of a function to the program 'this' if not specified at call site", () => {
      const bodyText = `
          function accessThisField () {
            return () => this.myField += 101;
          }
          accessThisField;
      `;
      const bodyKuery = transpileValaaScriptBody(bodyText);
      const programThis = { myField: 0 };
      const accessMyFieldFunc = evaluateProgram([], programThis, bodyKuery, {}, { verbosity: 0 });
      const firstAccessMyField = accessMyFieldFunc();
      expect(firstAccessMyField())
          .toEqual(101);
      expect(programThis.myField)
          .toEqual(101);

      const explicitThis = { myField: 10 };
      expect(firstAccessMyField.call(explicitThis))
          .toEqual(202);
      expect(programThis.myField)
          .toEqual(202);
      expect(explicitThis.myField)
          .toEqual(10);

      const secondAccessMyField = accessMyFieldFunc.call(explicitThis);
      expect(secondAccessMyField())
          .toEqual(111);
      expect(explicitThis.myField)
          .toEqual(111);

      const anotherExplicitThis = { myField: 20 };
      expect(secondAccessMyField.call(anotherExplicitThis))
          .toEqual(212);
      expect(explicitThis.myField)
          .toEqual(212);
      expect(anotherExplicitThis.myField)
          .toEqual(20);
    });
  });

  describe("loop structures", () => {
    it("while", () => {
      const bodyText = `
        let scopeSum = { value: 0 };
        function whileTest () {
          let iterations = 0;
          while (scopeSum.value < 10) {
            scopeSum.value += 1;
            iterations += 1;
          }
          return iterations;
        }
        [whileTest, scopeSum];
      `;
      const bodyKuery = transpileValaaScriptBody(bodyText);
      // console.log("bodyKuery VAKON", beaumpify(bodyKuery.toVAKON()));
      const [whileTest, scopeSum] = evaluateProgram([], {}, bodyKuery, {}, { verbosity: 0 });
      expect(whileTest())
          .toEqual(10);
      expect(scopeSum.value)
          .toEqual(10);
      expect(whileTest())
          .toEqual(0);
      expect(scopeSum.value)
          .toEqual(10);
    });
    it("do-while", () => {
      const bodyText = `
        let scopeSum = { value: 0 };
        function whileTest () {
          let iterations = 0;
          do {
            scopeSum.value += 1;
            iterations += 1;
          } while ((scopeSum.value < 10))
          return iterations;
        }
        [whileTest, scopeSum];
      `;
      const bodyKuery = transpileValaaScriptBody(bodyText);
      const [whileTest, scopeSum] = evaluateProgram([], {}, bodyKuery, {}, { verbosity: 0 });
      expect(whileTest())
          .toEqual(10);
      expect(scopeSum.value)
          .toEqual(10);
      expect(whileTest())
          .toEqual(1);
      expect(scopeSum.value)
          .toEqual(11);
    });
    it("while-return", () => {
      const bodyText = `
        let scopeSum = { value: 0 };
        function whileTest () {
          let iterations = 0;
          while (scopeSum.value < 10) {
            scopeSum.value += 1;
            if (iterations === 5) return iterations;
            iterations += 1;
          }
          return iterations;
        }
        [whileTest, scopeSum];
      `;
      const bodyKuery = transpileValaaScriptBody(bodyText);
      const [whileTest, scopeSum] = evaluateProgram([], {}, bodyKuery, {}, { verbosity: 0 });
      expect(whileTest())
          .toEqual(5);
      expect(scopeSum.value)
          .toEqual(6);
      expect(whileTest())
          .toEqual(4);
      expect(scopeSum.value)
          .toEqual(10);
    });
    it("nested-do-while-break-continue", () => {
      const bodyText = `
        let scopeSum = { value: 0 };
        function whileTest () {
          let iterations = 0;
          while (scopeSum.value < 10) {
            do {
              scopeSum.value += 1;
              if (scopeSum.value % 2) continue;
              if (scopeSum.value) break;
            } while (true);
            iterations += 1;
          }
          return iterations;
        }
        [whileTest, scopeSum];
      `;
      const bodyKuery = transpileValaaScriptBody(bodyText);
      const [whileTest, scopeSum] = evaluateProgram([], {}, bodyKuery, {}, { verbosity: 0 });
      expect(whileTest())
          .toEqual(5);
      expect(scopeSum.value)
          .toEqual(10);
    });
    it("for with array manipulation", () => {
      const bodyText = `
        let container = [];
        for (let i = 0; i !== 5; ++i) {
          container.push(fooText);
          container.push("dummy");
          container.pop();
          container.push(i);
        }
        container;
      `;
      const bodyKuery = transpileValaaScriptBody(bodyText);
      const programScope = { fooText: "nanny" };
      const container = evaluateProgram([], {}, bodyKuery, programScope, { verbosity: 0 });
      expect(container)
          .toEqual(["nanny", 0, "nanny", 1, "nanny", 2, "nanny", 3, "nanny", 4]);
    });
    it("for with variable shadowing", () => {
      const bodyText = `
        let fooSum = 0;
        let fooCon = "bar";
        let fooCat = "_";
        let i = 5;
        for (let i = 0; i !== 10; ++i) {
          fooSum += i;
          fooCat = fooCon + fooCat + foo.text;
        }
        [fooSum, fooCat]
      `;
      const bodyKuery = transpileValaaScriptBody(bodyText);
      const programScope = { foo: { text: "NaN" } };
      const [fooSum, fooCat] = evaluateProgram([], {}, bodyKuery, programScope, { verbosity: 0 });
      expect(fooSum)
          .toEqual(45);
      expect(fooCat)
          .toEqual("barbarbarbarbarbarbarbarbarbar_NaNNaNNaNNaNNaNNaNNaNNaNNaNNaN");
    });
    xit("for-of in global context", () => {
      const bodyText = `
        let fooSum = 0;
        let fooCat = "";
        for (const foo of this.something) {
          fooSum = foo.num;
          fooCat = fooCat + foo.text;
        }
        [fooSum, fooCat]
      `;
      const bodyKuery = transpileValaaScriptBody(bodyText);
      const programThis = { something: [{ num: 19, text: "bat" }, { num: 23, text: "bat" }] };
      const [fooSum, fooCat] = evaluateProgram([], programThis, bodyKuery, {}, { verbosity: 0 });
      expect(fooSum)
          .toEqual(42);
      expect(fooCat)
          .toEqual("batman");
    });
  });

  describe("delete operator", () => {
    it("deletes a native object property, but doesn't propagate to prototype properties", () => {
      const bodyText = `
        const base = { a: "a", b: "b", c: "c", d: "d", e: "e" };
        const derived = Object.assign(Object.create(base), {
          b: "+b", c: "+c", d: "+d", e: "+e",
        });
        delete base.a;
        delete base["b"];
        const cname = "c";
        delete base[cname];
        function getDerived() { return derived; }
        delete getDerived()[cname];
        delete derived.d;
        delete getDerived().e;
        delete getDerived().e;
        [base, derived]
      `;
      const bodyKuery = transpileValaaScriptBody(bodyText);
      const [base, derived] = evaluateProgram([], {}, bodyKuery, { Object }, { verbosity: 0 });
      expect(base.hasOwnProperty("a")).toEqual(false);
      expect(base.a).toBe(undefined);
      expect(base.hasOwnProperty("b")).toEqual(false);
      expect(base.b).toBe(undefined);
      expect(base.hasOwnProperty("c")).toEqual(false);
      expect(base.c).toBe(undefined);
      expect(base.hasOwnProperty("d")).toEqual(true);
      expect(base.d).toBe("d");
      expect(base.hasOwnProperty("e")).toEqual(true);
      expect(base.e).toBe("e");
      expect(derived.hasOwnProperty("a")).toEqual(false);
      expect(derived.a).toBe(undefined);
      expect(derived.hasOwnProperty("b")).toEqual(true);
      expect(derived.b).toBe("+b");
      expect(derived.hasOwnProperty("c")).toEqual(false);
      expect(derived.c).toBe(undefined);
      expect(derived.hasOwnProperty("d")).toEqual(false);
      expect(derived.d).toBe("d");
      expect(derived.hasOwnProperty("e")).toEqual(false);
      expect(derived.e).toBe("e");
    });

    it("throws when trying to delete a non-configurable property", () => {
      const bodyText = `
        const obj = {};
        Object.defineProperty(obj, "unconfigurable", { configurable: false });
        delete obj.unconfigurable;
        [obj]
      `;
      const bodyKuery = transpileValaaScriptBody(bodyText);
      expect(() => evaluateProgram([], {}, bodyKuery, { Object }, { verbosity: 0 }))
          .toThrow(/Cannot delete.*unconfigurable/);
    });
  });
/*
  describe("VALK lookups", () => {
    it("Should handle arrays", () => {
      expect(transpileValaaScriptBody("[1, 2, 3]"))
          .toEqual(VALSK.array(VALSK.fromValue(1), VALSK.fromValue(2), VALSK.fromValue(3)));
    });

    it("should escape to VALK if property access field name starts with '$'", () => {
      expect(transpileValaaScriptBody("this.foo.$to('bar')")).toEqual(
        propertyAccessKuery("foo").to("bar")
      );
    });

    it("should escape all '$' calls", () => {
      expect(transpileValaaScriptBody("$value(10)")).toEqual(VALSK.fromValue(10));
    });

    it("should escape to VALK for complex lookups", () => {
      expect(transpileValaaScriptBody("this.$to('foo').$to('bar')")).toEqual(
        VALSK.fromThis().to("foo").to("bar")
      );
    });

    it("should escape to VALK for complex lookups within assignments", () => {
      expect(transpileValaaScriptBody("this.$to('foo').$to('bar').prop = 10")).toEqual(
        VALSK.fromThis().to("foo").to("bar")
            .createOrUpdateProperty("prop", literalValue(VALSK.fromValue(10)), { scope: {} })
      );
    });
  });

  describe("native function invokation", () => {
    it("should run functions from objects in the scope", () => {
      expect(transpileValaaScriptBody("Math.floor(12.3)")).toEqual(
        VALSK.call(VALSK.fromScope("Math").to("floor"), VALSK.fromScope("Math"), 12.3)
      );
    });
  });
  */
});
