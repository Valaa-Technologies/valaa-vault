/* global jest describe expect beforeEach it */
import { created } from "~/raem/events";
import { vRef } from "~/raem/ValaaReference";

import { evaluateTestProgram } from "~/script/test/ScriptTestHarness";
import { transpileValaaScriptBody, transpileValaaScriptModule }
    from "~/script/transpileValaaScript";
import addExportsContainerToScope from "~/script/denormalized/addExportsContainerToScope";
import { getNativeIdentifierValue } from "~/script";
import VALSK, { Kuery, literal, pointer } from "~/script/VALSK";

const createBlockA = [
  created({ id: "A_parent", typeName: "TestScriptyThing" }),
  created({ id: "A_test", typeName: "TestScriptyThing", initialState: {
    owner: vRef("A_parent", "children")
  }, }),
  created({ id: "test.myFunc", typeName: "Property", initialState: {
    name: "myFunc", owner: vRef("A_test", "properties"),
    value: literal(VALSK.doStatements(VALSK.apply(
        VALSK.fromScope("propertyCallback").notNull(), VALSK.fromScope("this"))).toJSON()),
  }, }),
  created({ id: "test.age", typeName: "Property", initialState: {
    name: "age", owner: vRef("A_test", "properties"),
    value: literal(35),
  }, }),
  created({ id: "test.myParent", typeName: "Property", initialState: {
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

describe("ValaaScriptECMAScript2015", () => {
// testing templateLiterals has problems because transpileValaaScript uses template literals
// test function cannot be tested properly. every nested template literal has been tested with
// external program by putting it to "console.log(`<nest>`);" and having a long manual inspection.
// so fingers crossed, hope it works! ;)
  describe("Template literals", () => {
    it("testing template literals with simple return function", () => {
      const bodyKuery = transpileValaaScriptBody(`
        function foo () {
          let ten = 10;
          let window = "window";
          return \`ten: \${ten} and \${ window }\`;
        };
        foo();
      `);

      const str = evaluateProgram([], {}, bodyKuery, {});
      expect(str).toEqual("ten: 10 and window");
    });

    it("testing tagged template expressions", () => {
      const bodyKuery = transpileValaaScriptBody(`
          function foo (strings, key) {
            let strs = strings.join("");
            strs += key;
            return strs;
          };
        foo\`age \${10}is \`;
      `);
      const testStr = evaluateProgram([], {}, bodyKuery, {});
      expect(testStr).toEqual("age is 10");
    });

    it("testing template literals with escape characters", () => {
      const bodyKuery = transpileValaaScriptBody(`
        function foo () {
          return \`\\u{61}\\u{6c}\\u{6c} \\u{69}\\u{73} \\u{77}\\u{65}\\u{6c}\\u{6c}\`;
        }
        foo();
      `);
      const str = evaluateProgram([], {}, bodyKuery, {});
      expect(str).toEqual("all is well");
    });
  });

  // For of is effective specially when using 2d arrays or any other nested iterables.
  // Because of that for of has two tests, with and without destructuring

  describe("for..of -loop", () => {
    xit("declares a trivial array and iterates it with for of loop", () => {
      const bodyKuery = transpileValaaScriptBody(`
        function foofoo () {
          const foo = [1, 1, 1, 1];
          let bar = 0;
          for (let one of foo) {
            bar += one;
          }
          return [bar,foo];
        }
        foofoo();
      `);
      const [sum, table] = evaluateProgram([], {}, bodyKuery, {});
      expect(sum).toEqual(4);
      expect(table).toEqual([1, 1, 1, 1]);
    });


    // test needs destructuring features
    xit("declares a 2d array and iterates it with for of loop", () => {
      const bodyKuery = transpileValaaScriptBody(`
        function foofoo () {
          const foo = [[0, "zero"], [1, "one"], [2, "two"]];
          let keys = [];
          let values = [];
          for (const [key, value] of foo) {
            keys.push(key);
            values.push(value);
          }
          return [keys, values];
        }
        foofoo();
      `);
      const [keys, values] = evaluateProgram([], {}, bodyKuery, {});
      expect(keys).toEqual([0, 1, 2]);
      expect(values).toEqual(["zero", "one", "two"]);
    });

    // with normal for loop
    xit("declares a 2d array and iterates it with basic for loop", () => {
      const bodyKuery = transpileValaaScriptBody(`
        function foofoo () {
          const foo = [[0, "zero"], [1, "one"], [2,"two"]];
          let keys = [];
          let values = [];
          for (let i = 0; i < foo.length; i++) {
            keys.push(foo[i][0]);
            values.push(foo[i][1]);
          }
          return [keys, values];
        }
        foofoo();
      `);
      const [keys, values] = evaluateProgram([], {}, bodyKuery, {});
      expect(keys).toEqual([0, 1, 2]);
      expect(values).toEqual(["zero", "one", "two"]);
    });
  });

  describe("tests spread elements", () => {
    it("declares a function and calls it with a spread syntax", () => {
      const bodyKuery = transpileValaaScriptBody(`
        function foo (w, x, y, z) {
          return w + x + y + z;
        };
        const bar = [1, 2, 3];
        const baz = 0;
        foo(baz, ...bar);
      `);
      const result = evaluateProgram([], {}, bodyKuery, {});
      expect(result).toEqual(6);
    });

    // I think this is es2016 of es2017 feature
    xit("declares object and copies it with spread function", () => {
      const bodyKuery = transpileValaaScriptBody(`
        function test () {
          const foo = { bar: "test" };
          const foofoo = { ...foo };
          return foofoo.bar;
        };
        test();
      `);
      const result = evaluateProgram([], {}, bodyKuery, {});
      expect(result).toEqual("test");
    });

    // tests merge with objects. foofoo.bar should overwrite foo.bar
    // I think this is es2016 of es2017 feature
    xit("merges two objects with spread syntax", () => {
      const bodyKuery = transpileValaaScriptBody(`
        function test () {
          const foo = { bar: "not working", x: 2 };
          const foofoo = { bar: "working", y: 3 };
          const merged = { ...foo, ...foofoo };
          return [merged.bar, merged.x, merged.y];
        };
        test();
      `);
      const [bar, x, y] = evaluateProgram([], {}, bodyKuery, {});
      expect(bar).toEqual("working");
      expect(x).toEqual(2);
      expect(y).toEqual(3);
    });

    it("merges array and variables with spread syntax", () => {
      const bodyKuery = transpileValaaScriptBody(`
        function test () {
          const foo = "test";
          const fob = ["works"];
          const foc = "fine";
          const merged = [ foo, ...fob, foc ];
          return merged.join(" ");
        };
        test();
      `);
      const result = evaluateProgram([], {}, bodyKuery, {});
      expect(result).toEqual("test works fine");
    });

    // tests array merge with "..." spread
    it("merges two arrays with spread syntax", () => {
      const bodyKuery = transpileValaaScriptBody(`
        function test () {
          const foo = ["test"];
          const foofoo = ["works"];
          const merged = [ ...foo, ...foofoo];
          return merged.join(" ");
        };
        test();
      `);
      const result = evaluateProgram([], {}, bodyKuery, {});
      expect(result).toEqual("test works");
    });
  });

  // didn't get generator work with node.js and babel. So not tested
  describe("tests generators aka function*, and yield", () => {
    xit("declares function* with incremental variable", () => {
      const bodyKuery = transpileValaaScriptBody(`
        function* incr (i) {
          yield i;
          yield ++i;
          yield ++i;
        }
        let gen = incr(0);
        (() => [incr().next().value, incr().next().value, incr().next().value])();
      `);
      const [zero, one, two] = evaluateProgram([], {}, bodyKuery, []);
      expect(zero).toEqual(0);
      expect(one).toEqual(1);
      expect(two).toEqual(2);
    });
  });

  // these variable types are tested so many times that i guess it won't be too serious business
  describe("var let const declarations: ", () => {
    it("fails to mutate const variable", () => {
      const bodyKuery = transpileValaaScriptBody(`
        function foofoo () {
          const foo = 10;
          foo = 42;
          return foo;
        }
        foofoo();
      `);
      expect(() => evaluateProgram([], {}, bodyKuery, []))
          .toThrow(/Cannot.*read only/);
    });

    it("is able to mutate a let variable", () => {
      const bodyKuery = transpileValaaScriptBody(`
        function foofoo () {
          let foo = 10;
          foo = 42;
          return foo;
        }
        foofoo();
      `);
      const foo = evaluateProgram([], {}, bodyKuery, []);
      expect(foo).toEqual(42);
    });

    it("declares const object and changes it's property value", () => {
      const bodyKuery = transpileValaaScriptBody(`
        function foofoo () {
          const foo = { key: 3 };
          foo.key = 4;
          return foo.key;
        }
        foofoo();
      `);
      const test = evaluateProgram([], {}, bodyKuery, []);
      expect(test).toEqual(4);
    });

    it("declares const array and changes it's element value", () => {
      const bodyKuery = transpileValaaScriptBody(`
        function foofoo () {
          const foo = [3];
          foo[0] = 4;
          return foo;
        }
        foofoo()[0];
      `);
      const test = evaluateProgram([], {}, bodyKuery, []);
      expect(test).toEqual(4);
    });
    it("declares let variable and tests it in different scopes", () => {
      const bodyKuery = transpileValaaScriptBody(`
        let foo = 3;
        function bar () {
          let foo = 4;
          return foo;
        };
        (() => [foo, bar()])();
      `);
      const [foo, bar] = evaluateProgram([], {}, bodyKuery, []);
      expect(foo).toEqual(3);
      expect(bar).toEqual(4);
    });
  });

  // destructuring tests from mdn webdocs destructuring examples.
  describe("destructuring: ", () => {
    xit("sets two variables with array", () => {
      const bodyKuery = transpileValaaScriptBody(`
        let a, b;
        function foo () {
          return [10, 20];
        };
        [a, b] = foo();
        (() => [a, b])();
      `);
      const [a, b] = evaluateProgram([], {}, bodyKuery, []);
      expect(a).toEqual(10);
      expect(b).toEqual(20);
    });

    // needs spread syntax
    xit("sets two variables and array with a single array", () => {
      const bodyKuery = transpileValaaScriptBody(`
        let a, b, rest;
        function foo () {
          return [10, 20, 30, 40, 50];
        };
        [a, b, ...rest] = foo();
        (() => [a, b, rest])();
      `);
      const [a, b, ...rest] = evaluateProgram([], {}, bodyKuery, []);
      expect(a).toEqual(10);
      expect(b).toEqual(20);
      expect(rest).toEqual([30, 40, 50]);
    });

    xit("set two variables with an object", () => {
      const bodyKuery = transpileValaaScriptBody(`
        let bar = { a: 2, b: 3 };
        let { a, b } = bar;
        (() => [a, b])();
      `);
      const [a, b] = evaluateProgram([], {}, bodyKuery, []);
      expect(a).toEqual(2);
      expect(b).toEqual(3);
    });

    xit("ignore one value from array", () => {
      const bodyKuery = transpileValaaScriptBody(`
        let a, b;
        function foo () {
          return [1, 2, 3];
        }
        [a, , b] = foo();
        (() => [a, b])();
      `);
      const [a, b] = evaluateProgram([], {}, bodyKuery, []);
      expect(a).toEqual(1);
      expect(b).toEqual(3);
    });

    xit("function default argument declaration with object destructuring", () => {
      const bodyKuery = transpileValaaScriptBody(`
        function chart ({ a = 1, b = { bb: 2, cc: 3 }, d = 4 } = {}) {
            return { a, b, d };
        };
        let foo = chart({ a: 2 });
        let foofoo = chart();
        (() => [foo.a, foo.b.cc, foofoo.a, foofoo.b.cc])();
      `);
      const [a, b, c, d] = evaluateProgram([], {}, bodyKuery, []);
      expect(a).toEqual(2);
      expect(b).toEqual(3);
      expect(c).toEqual(1);
      expect(d).toEqual(3);
    });
  });

  // TODO: prototypes in classes
  describe("classes: ", () => {
    xit("default class declaration with setter and getter", () => {
      const moduleKuery = transpileValaaScriptModule(`
        class Foo {
          constructor (x = 10, y = 20) {
            this.x = x;
            this.y = y;
          }

          get coords () {
            return [this.x, this.y];
          }

          set coords ([x, y]) {
            this.x = x;
            this.y = y;
          }
        }
        let bar = new Foo ();
        bar.coords = [20,30];
        (() => bar.coords)();
      `);
      const [x, y] = evaluateProgram([], {}, moduleKuery, []);
      expect(x).toEqual(20);
      expect(y).toEqual(30);
    });

    xit("default class declaration and static function", () => {
      const moduleKuery = transpileValaaScriptModule(`
        class Foo {
          constructor (x, y = 20) {
            this.x = x;
            this.y = y;
          }

          static inverse (foo) {
            return [foo.y,foo.x];
          }
        }
        let bar = new Foo (10);
        Foo.inverse(bar);
      `);
      const [x, y] = evaluateProgram([], {}, moduleKuery, []);
      expect(x).toEqual(20);
      expect(y).toEqual(10);
    });

    xit("class declaration expression", () => {
      const moduleKuery = transpileValaaScriptModule(`
        const Foo = class {
          constructor () {
            this.x = 10;
            this.y = 20;
          }
        };
        let bar = new Foo();
        (() => [bar.x, bar.y])();
      `);
      const [x, y] = evaluateProgram([], {}, moduleKuery, []);
      expect(x).toEqual(10);
      expect(y).toEqual(20);
    });

    xit("inherited constructor, function overloading and super", () => {
      const moduleKuery = transpileValaaScriptModule(`
        class Foo {
          constructor (x = 10, y = 20) {
            this.x = x;
            this.y = y;
          }

          inverse () {
            return [this.y, this.x];
          }
        };

        class SubFoo extends Foo {
          inverse () {
            [this.x, this.y] = super.inverse();
            return [this.y, this.x];
          }
        }

        let subBar = new SubFoo(30);
        subBar.inverse();
      `);
      const [x, y] = evaluateProgram([], {}, moduleKuery, []);
      expect(x).toEqual(30);
      expect(y).toEqual(20);
    });
  });

  // TODO: prototypes in classes

  function addTestRequireToScope (scope: Object, exports: Object) {
    scope.require = (importPath: string) => (!exports[importPath]
        ? undefined
        : addExportsContainerToScope({}, { ...exports[importPath] }));
  }

  describe("export: ", () => {
    it("standard export for variable", () => {
      const moduleKuery = transpileValaaScriptModule(`
        export let foo = 10;
      `);
      const scope = {};
      const exports = addExportsContainerToScope(scope);
      evaluateProgram([], {}, moduleKuery, scope);
      expect(exports.foo).toEqual(10);
    });

    it("export with specifiers", () => {
      const moduleKuery = transpileValaaScriptModule(`
        let foo = 10;
        let boo = function () { return 20; };
        export { foo as far, boo as bar };
      `);
      const scope = {};
      const exports = addExportsContainerToScope(scope);
      evaluateProgram([], {}, moduleKuery, scope);
      expect(exports.far + exports.bar()).toEqual(30);
    });

    it("standard export for function", () => {
      const moduleKuery = transpileValaaScriptModule(`
        export function foo () { return 10; };
      `);
      const scope = {};
      const exports = addExportsContainerToScope(scope);
      evaluateProgram([], {}, moduleKuery, scope);
      expect(exports.foo()).toEqual(10);
    });

    xit("standard export for class", () => {
      const moduleKuery = transpileValaaScriptModule(`
        export class Foo {
          constructor () { this bar = 10; }
          get bar() { return this.bar; }
        };
      `);
      const scope = {};
      const exports = addExportsContainerToScope(scope);
      evaluateProgram([], {}, moduleKuery, scope);
      expect((new exports.Foo()).bar).toEqual(10);
    });

    it("default export for literal value", () => {
      const moduleKuery = transpileValaaScriptModule(`
        export default foo.bar;
      `);
      const scope = { foo: { bar: 10 } };
      const exports = addExportsContainerToScope(scope);
      evaluateProgram([], {}, moduleKuery, scope);
      expect(exports.default).toEqual(10);
    });

    xit("export all pass-thorugh", () => {
      const moduleKuery = transpileValaaScriptModule(`
        export * from "bar";
      `);
      const scope = {};
      addTestRequireToScope(scope, { bar: {
        default: 10,
        foo: 20,
        baz: 5,
      } });
      const exports = addExportsContainerToScope(scope);
      evaluateProgram([], {}, moduleKuery, scope);
      expect(exports.default).toEqual(undefined);
      expect(exports.foo).toEqual(20);
      expect(exports.baz).toEqual(5);
    });
  });

  describe("import: ", () => {
    it("default imports", () => {
      const moduleKuery = transpileValaaScriptModule(`
        import foo from "bar";
      `);
      const scope = {};
      addTestRequireToScope(scope, { bar: {
        default: {
          baz: 10
        },
      } });
      evaluateProgram([], {}, moduleKuery, scope);
      expect(getNativeIdentifierValue(scope.foo).baz).toEqual(10);
    });

    it("default imports for function", () => {
      const moduleKuery = transpileValaaScriptModule(`
        import foo from "bar";
      `);
      const scope = {};
      addTestRequireToScope(scope, { bar: {
        default: {
          baz: (() => 10),
        },
      } });
      evaluateProgram([], {}, moduleKuery, scope);
      expect(getNativeIdentifierValue(scope.foo).baz()).toEqual(10);
    });

    it("imports with specifier", () => {
      const moduleKuery = transpileValaaScriptModule(`
        import { foofoo as foo } from "bar";
      `);
      const scope = {};
      addTestRequireToScope(scope, { bar: {
        foofoo: {
          baz: (() => 10),
        },
      } });
      evaluateProgram([], {}, moduleKuery, scope);
      expect(getNativeIdentifierValue(scope.foo).baz()).toEqual(10);
    });

    it("imports with complex specifier", () => {
      const moduleKuery = transpileValaaScriptModule(`
        import moo, { foofoo as foo, barbar as bar } from "bar";
      `);
      const scope = {};
      addTestRequireToScope(scope, { bar: {
        default: {
          booboo: 5,
        },
        foofoo: {
          baz: (() => 10),
        },
        barbar: {
          baz: 20,
        },
      } });
      evaluateProgram([], {}, moduleKuery, scope);
      expect(getNativeIdentifierValue(scope.moo).booboo).toEqual(5);
      expect(getNativeIdentifierValue(scope.foo).baz()).toEqual(10);
      expect(getNativeIdentifierValue(scope.bar).baz).toEqual(20);
    });

    it("imports namespace", () => {
      const moduleKuery = transpileValaaScriptModule(`
        import * as foo from "bar";
      `);
      const scope = {};
      addTestRequireToScope(scope, { bar: {
        default: {
          booboo: 5,
        },
        foofoo: {
          baz: (() => 10),
        },
        barbar: {
          baz: 20,
        },
      } });
      evaluateProgram([], {}, moduleKuery, scope);
      expect(getNativeIdentifierValue(scope.foo).default.booboo).toEqual(5);
      expect(getNativeIdentifierValue(scope.foo).foofoo.baz()).toEqual(10);
      expect(getNativeIdentifierValue(scope.foo).barbar.baz).toEqual(20);
    });

    xit("standard export for class", () => {
      const moduleKuery = transpileValaaScriptModule(`
        export class Foo {
          constructor () {this bar = 10;}
          get bar() {return this.bar;}
        };
      `);
      const scope = {};
      const exports = addExportsContainerToScope(scope);
      evaluateProgram([], {}, moduleKuery, scope);
      expect(scope.Foo).toBe(exports.Foo);
      expect((new exports.Foo()).bar).toEqual(10);
    });

    it("default export for number", () => {
      const moduleKuery = transpileValaaScriptModule(`
        export default 10;
      `);
      const scope = {};
      const exports = addExportsContainerToScope(scope);
      evaluateProgram([], {}, moduleKuery, scope);
      expect(exports.default).toEqual(10);
    });
  });
});
