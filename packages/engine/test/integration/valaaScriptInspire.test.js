/* global jest describe expect beforeEach it */

import { created } from "~/raem/events";
import { vRef } from "~/raem/ValaaReference";

import { createNativeIdentifier, getNativeIdentifierValue, transpileValaaScriptBody }
    from "~/script";

import Vrapper from "~/engine/Vrapper";
import { createEngineTestHarness, createEngineOracleHarness }
    from "~/engine/test/EngineTestHarness";
import { clearAllScribeDatabases } from "~/prophet/test/ProphetTestHarness";
import VALEK, { Kuery, literal, pointer } from "~/engine/VALEK";

const valaaScriptBlock = [
  created({ id: ["creator-myFunc"], typeName: "Property", initialState: {
    name: "myFunc", owner: vRef("creator", "properties"),
    value: literal(VALEK.doStatements(VALEK.apply(
        VALEK.fromScope("propertyCallback").notNull(), VALEK.fromScope("this"))).toJSON()),
  }, }),
];

let harness: { createds: Object, engine: Object, prophet: Object, testEntities: Object };
afterEach(async () => {
  await clearAllScribeDatabases();
  harness = null;
}); // eslint-disable-line no-undef

const entities = () => harness.createds.Entity;
// const properties = () => harness.createds.Property;

/**
 * Calls given expressionKuery against given corpus, setting given thisReference as the call this
 * and given scope as the lexical scope of the call.
 * Sets up the global harness variable.
 *
 * @param {any}    corpus
 * @param {Kuery}  parsedKuery
 * @param {VRef}   thisReference
 * @param {Object} scope
 * @returns                       the resulting value of the expressionKuery
 */
function evaluateProgram (programKuery: Kuery, head, scope: ?Object,
    options: Object = {}) {
  if (scope) {
    options.scope = scope;
    scope.this = head;
  }
  return harness.engine.run(head, programKuery, options);
}

function getFieldOf (object: any, name: string, options = {}) {
  return (object instanceof Vrapper)
      ? object.propertyValue(name, options)
      : object[name];
}

function extractValueFrom (container: any) {
  return container instanceof Vrapper
      ? container.extractValue()
      : getNativeIdentifierValue(container);
}

function transpileValaaScriptTestBody (bodyText: string) {
  return transpileValaaScriptBody(bodyText, { customVALK: VALEK });
}

describe("@valos/engine - @valos/script integrations", () => {
  describe("Manipulating existing variables", () => {
    it("assigns existing Resource property variable with 'counter = 75' when valked", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, valaaScriptBlock);
      const bodyKuery = transpileValaaScriptTestBody(`
          counter = 75;
      `);
      const updatedCounter = entities().creator.do(bodyKuery, { verbosity: 0 });
      expect(updatedCounter)
          .toEqual(75);
      expect(entities().creator.get(VALEK.propertyLiteral("counter")))
          .toEqual(75);
    });
  });

  describe("delete operator", () => {
    it("deletes a native object property, but doesn't propagate to prototype properties", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, valaaScriptBlock);
      const programText = `
        const base = new Entity({ owner: this, properties: {
          a: "a", b: "b", c: "c", d: "d", e: "e"
        } });
        const derived = Object.assign(new base({ owner: this }), {
          b: "+b", c: "+c", d: "+d", e: "+e",
        });
        delete base.a;
        // We should allow deleting base object properties somehow. This is now prevented by
        // derived.b existing.
        // delete base["b"];
        const cname = "c";
        function getDerived() { return derived; }
        delete getDerived()[cname];
        delete base[cname];
        delete derived.d;
        delete getDerived().e;
        delete getDerived().e;
        [{
          a: { has: base.hasOwnProperty("a"), value: base.a },
          b: { has: base.hasOwnProperty("b"), value: base.b },
          c: { has: base.hasOwnProperty("c"), value: base.c },
          d: { has: base.hasOwnProperty("d"), value: base.d },
          e: { has: base.hasOwnProperty("e"), value: base.e },
        }, {
          a: { has: derived.hasOwnProperty("a"), value: derived.a },
          b: { has: derived.hasOwnProperty("b"), value: derived.b },
          c: { has: derived.hasOwnProperty("c"), value: derived.c },
          d: { has: derived.hasOwnProperty("d"), value: derived.d },
          e: { has: derived.hasOwnProperty("e"), value: derived.e },
        }]
      `;
      const bodyKuery = transpileValaaScriptTestBody(programText);
      const [base, derived] = entities().creator.do(bodyKuery, { verbosity: 0 });
      expect(base.a.has).toEqual(false);
      expect(base.a.value).toBe(undefined);
      expect(base.b.has).toEqual(true);
      expect(base.b.value).toBe("b");
      expect(base.c.has).toEqual(false);
      expect(base.c.value).toBe(undefined);
      expect(base.d.has).toEqual(true);
      expect(base.d.value).toBe("d");
      expect(base.e.has).toEqual(true);
      expect(base.e.value).toBe("e");
      expect(derived.a.has).toEqual(false);
      expect(derived.a.value).toBe(undefined);
      expect(derived.b.has).toEqual(true);
      expect(derived.b.value).toBe("+b");
      expect(derived.c.has).toEqual(false);
      expect(derived.c.value).toBe(undefined);
      expect(derived.d.has).toEqual(false);
      expect(derived.d.value).toBe("d");
      expect(derived.e.has).toEqual(false);
      expect(derived.e.value).toBe("e");
    });

    it("assigns existing Resource property variable with 'counter = 75' when valked", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, valaaScriptBlock);
      const bodyKuery = transpileValaaScriptTestBody(`
          counter = 75;
      `);
      const updatedCounter = entities().creator.do(bodyKuery, { verbosity: 0 });
      expect(updatedCounter)
          .toEqual(75);
      expect(entities().creator.get(VALEK.propertyLiteral("counter")))
          .toEqual(75);
    });

    it("returns undefined for typeof identifiers which are missing, instead of throwing", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, valaaScriptBlock);
      const bodyKuery = transpileValaaScriptTestBody(`
          typeof doesntExist;
      `);
      const undefinedString = entities().creator.do(bodyKuery, { verbosity: 0 });
      expect(undefinedString)
          .toEqual("undefined");
    });
  });

  function testPropertyByExpressionAssignments (commands, getThisAndScope) {
    it("assigns numbers", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, commands);
      const kuery = transpileValaaScriptTestBody(`
          this.startsAsTen = 1;
      `);
      const { this_, scope } = getThisAndScope();
      const result = evaluateProgram(kuery, this_, scope, { verbosity: 0 });
      expect(result)
          .toEqual(1);
      expect(getFieldOf(this_, "startsAsTen"))
          .toEqual(1);
    });

    it("assigns strings", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, commands);
      const kuery = transpileValaaScriptTestBody(`
          this.startsAsTen = 'hello';
      `);
      const { this_, scope } = getThisAndScope();
      const result = evaluateProgram(kuery, this_, scope, { verbosity: 0 });
      expect(result)
          .toEqual("hello");
      expect(getFieldOf(this_, "startsAsTen"))
          .toEqual("hello");
    });

    it("assigns booleans", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, commands);
      const kuery = transpileValaaScriptTestBody(`
          this.startsAsTen = true;
      `);
      const { this_, scope } = getThisAndScope();
      const result = evaluateProgram(kuery, this_, scope, { verbosity: 0 });
      expect(result)
          .toEqual(true);
      expect(getFieldOf(this_, "startsAsTen"))
          .toEqual(true);
    });

    it("assigns JSON", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, commands);
      const kuery = transpileValaaScriptTestBody(`
          this.startsAsTen = { prop1: 2, prop2: 1 };
      `);
      const { this_, scope } = getThisAndScope();
      const result = evaluateProgram(kuery, this_, scope, { verbosity: 0 });
      expect(result)
          .toEqual({ prop1: 2, prop2: 1 });
      expect(getFieldOf(this_, "startsAsTen"))
          .toEqual({ prop1: 2, prop2: 1 });
    });

    it("assigns null", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, commands);
      const kuery = transpileValaaScriptTestBody(`
          this.startsAsTen = null;
      `);
      const { this_, scope } = getThisAndScope();
      const result = evaluateProgram(kuery, this_, scope, { verbosity: 0 });
      expect(result)
          .toEqual(null);
      expect(getFieldOf(this_, "startsAsTen"))
          .toEqual(null);
    });

    it("handles addition", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, commands);
      const kuery = transpileValaaScriptTestBody(`
          this.startsAsUndefined = 1 + 1;
      `);
      const { this_, scope } = getThisAndScope();
      const result = evaluateProgram(kuery, this_, scope, { verbosity: 0 });
      expect(result)
          .toEqual(2);
      expect(getFieldOf(this_, "startsAsUndefined"))
          .toEqual(2);
    });

    it("handles subtraction", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, commands);
      const kuery = transpileValaaScriptTestBody(`
          this.startsAsUndefined = 1 - 3;
      `);
      const { this_, scope } = getThisAndScope();
      const result = evaluateProgram(kuery, this_, scope, { verbosity: 0 });
      expect(result)
          .toEqual(-2);
      expect(getFieldOf(this_, "startsAsUndefined"))
          .toEqual(-2);
    });

    it("handles multiplication", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, commands);
      const kuery = transpileValaaScriptTestBody(`
          this.startsAsUndefined = 5 * 3;
      `);
      const { this_, scope } = getThisAndScope();
      const result = evaluateProgram(kuery, this_, scope, { verbosity: 0 });
      expect(result)
          .toEqual(15);
      expect(getFieldOf(this_, "startsAsUndefined"))
          .toEqual(15);
    });

    it("handles division", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, commands);
      const kuery = transpileValaaScriptTestBody(`
          this.startsAsUndefined = 5 / 3;
      `);
      const { this_, scope } = getThisAndScope();
      const result = evaluateProgram(kuery, this_, scope, { verbosity: 0 });
      expect(result)
          .toEqual(5 / 3);
      expect(getFieldOf(this_, "startsAsUndefined"))
          .toEqual(5 / 3);
    });

    it("handles modulo", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, commands);
      const kuery = transpileValaaScriptTestBody(`
          this.startsAsUndefined = 999 % 500;
      `);
      const { this_, scope } = getThisAndScope();
      const result = evaluateProgram(kuery, this_, scope, { verbosity: 0 });
      expect(result)
          .toEqual(499);
      expect(getFieldOf(this_, "startsAsUndefined"))
          .toEqual(499);
    });

    it("handles unary minus", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, commands);
      const kuery = transpileValaaScriptTestBody(`
          this.startsAsUndefined = -999;
      `);
      const { this_, scope } = getThisAndScope();
      const result = evaluateProgram(kuery, this_, scope, { verbosity: 0 });
      expect(result)
          .toEqual(-999);
      expect(getFieldOf(this_, "startsAsUndefined"))
          .toEqual(-999);
    });

    it("handles exponentiation", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, commands);
      const kuery = transpileValaaScriptTestBody(`
          this.startsToOwnling = 5 ** 7;
      `);
      const { this_, scope } = getThisAndScope();
      const result = evaluateProgram(kuery, this_, scope, { verbosity: 0 });
      expect(result)
          .toEqual(5 ** 7);
      expect(getFieldOf(this_, "startsToOwnling"))
          .toEqual(5 ** 7);
    });

    /* eslint-disable no-bitwise */
    it("handles bitwise AND", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, commands);
      const kuery = transpileValaaScriptTestBody(`
          this.startsToOwnling = 12 & 2;
      `);
      const { this_, scope } = getThisAndScope();
      const result = evaluateProgram(kuery, this_, scope, { verbosity: 0 });
      expect(result)
          .toEqual(12 & 2);
      expect(getFieldOf(this_, "startsToOwnling"))
          .toEqual(12 & 2);
    });

    it("handles bitwise OR", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, commands);
      const kuery = transpileValaaScriptTestBody(`
          this.startsToOwnling = 12 | 2;
      `);
      const { this_, scope } = getThisAndScope();
      const result = evaluateProgram(kuery, this_, scope, { verbosity: 0 });
      expect(result)
          .toEqual(12 | 2);
      expect(getFieldOf(this_, "startsToOwnling"))
          .toEqual(12 | 2);
    });

    it("handles bitwise XOR", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, commands);
      const kuery = transpileValaaScriptTestBody(`
          this.startsToOwnling = 12 ^ 2;
      `);
      const { this_, scope } = getThisAndScope();
      const result = evaluateProgram(kuery, this_, scope, { verbosity: 0 });
      expect(result)
          .toEqual(12 ^ 2);
      expect(getFieldOf(this_, "startsToOwnling"))
          .toEqual(12 ^ 2);
    });

    it("handles bitwise NOT", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, commands);
      const kuery = transpileValaaScriptTestBody(`
          this.startsToOwnling = ~2;
      `);
      const { this_, scope } = getThisAndScope();
      const result = evaluateProgram(kuery, this_, scope, { verbosity: 0 });
      expect(result)
          .toEqual(~2);
      expect(getFieldOf(this_, "startsToOwnling"))
          .toEqual(~2);
    });

    it("handles bit shift left", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, commands);
      const kuery = transpileValaaScriptTestBody(`
          this.startsToOwnling = 5 << 3;
      `);
      const { this_, scope } = getThisAndScope();
      const result = evaluateProgram(kuery, this_, scope, { verbosity: 0 });
      expect(result)
          .toEqual(5 << 3);
      expect(getFieldOf(this_, "startsToOwnling"))
          .toEqual(5 << 3);
    });

    it("handles bit shift right", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, commands);
      const kuery = transpileValaaScriptTestBody(`
          this.startsToOwnling = 5 >> 3;
      `);
      const { this_, scope } = getThisAndScope();
      const result = evaluateProgram(kuery, this_, scope, { verbosity: 0 });
      expect(result)
          .toEqual(5 >> 3);
      expect(getFieldOf(this_, "startsToOwnling"))
          .toEqual(5 >> 3);
    });
  }

  function testStatementOperations (commands, getThisAndScope) {
    it("handles if and true '>'", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, commands);
      const kuery = transpileValaaScriptTestBody(`
          if (10 > 1) this.startsToOwnling = 'then';
          this.startsToOwnling;
      `);
      const { this_, scope } = getThisAndScope();
      const result = evaluateProgram(kuery, this_, scope, { verbosity: 0 });
      expect(result)
          .toEqual("then");
      expect(getFieldOf(this_, "startsToOwnling"))
          .toEqual("then");
    });

    it("handles if and false '!=='", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, commands);
      const kuery = transpileValaaScriptTestBody(`
          if (2 !== 2); else this.startsToOwnling = 'else';
          this.startsToOwnling;
      `);
      const { this_, scope } = getThisAndScope();
      const result = evaluateProgram(kuery, this_, scope, { verbosity: 0 });
      expect(result)
          .toEqual("else");
      expect(getFieldOf(this_, "startsToOwnling"))
          .toEqual("else");
    });

    it("handles if and true field-to-field with '!=' with block", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, commands);
      const kuery = transpileValaaScriptTestBody(`
          if (this.startsAsTen != this.startsAsUndefined) { this.startsToOwnling = 'then'; }
          this.startsToOwnling;
      `);
      const { this_, scope } = getThisAndScope();
      const result = evaluateProgram(kuery, this_, scope, { verbosity: 0 });
      expect(result)
          .toEqual("then");
      expect(getFieldOf(this_, "startsToOwnling"))
          .toEqual("then");
    });

    it("handles if and true < with 'wrong' block", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, commands);
      const kuery = transpileValaaScriptTestBody(`
          if (9 < this.startsAsTen); else { this.startsToOwnling = 'else'; }
          this.startsToOwnling;
      `);
      const { this_, scope } = getThisAndScope();
      const result = evaluateProgram(kuery, this_, scope, { verbosity: 0 });
      expect(result)
          .toEqual(entities().ownling);
      expect(getFieldOf(this_, "startsToOwnling"))
          .toEqual(entities().ownling);
    });

    it("handles if and false <= with content in both blocks", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, commands);
      const kuery = transpileValaaScriptTestBody(`
          if (this.startsAsTen <= null) {
            this.startsToOwnling = 'then';
          } else {
            this.startsToOwnling = 'else';
          }
          this.startsToOwnling;
      `);
      const { this_, scope } = getThisAndScope();
      const result = evaluateProgram(kuery, this_, scope, { verbosity: 0 });
      expect(result)
          .toEqual("else");
      expect(getFieldOf(this_, "startsToOwnling"))
          .toEqual("else");
    });

    it("handles ternary >=", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, commands);
      const kuery = transpileValaaScriptTestBody(`
          this.startsAsUndefined = (null >= 0) ? 1 : '';
      `);
      const { this_, scope } = getThisAndScope();
      const result = evaluateProgram(kuery, this_, scope, { verbosity: 0 });
      expect(result)
          .toEqual(1);
      expect(getFieldOf(this_, "startsAsUndefined"))
          .toEqual(1);
    });

    it("handles pointer-!", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, commands);
      const kuery = transpileValaaScriptTestBody(`
          if (!this.startsToOwnling) {
            this.startsAsUndefined = 10;
          } else {
            this.startsAsUndefined = 20;
          };
          this.startsAsUndefined;
      `);
      const { this_, scope } = getThisAndScope();
      const result = evaluateProgram(kuery, this_, scope, { verbosity: 0 });
      expect(result)
          .toEqual(20);
      expect(getFieldOf(this_, "startsAsUndefined"))
          .toEqual(20);
    });

    it("handles undefined-!! with scope assignment and explicit VALK kuery usage", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, commands);
      const kuery = transpileValaaScriptTestBody(`
          var scopeVar = 10;
          if (!!this.startsAsUndefined) {
            scopeVar = 20;
          }
          ({ scopeVar: scopeVar, closure: $fromScope() });
      `);
      const { this_, scope } = getThisAndScope();
      const { scopeVar, closure } = evaluateProgram(kuery, this_, scope, { verbosity: 0 });
      expect(scopeVar)
          .toEqual(10);
      expect(getNativeIdentifierValue(closure.scopeVar))
          .toEqual(10);
    });

    it("handles && with no short-circuit", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, commands);
      const kuery = transpileValaaScriptTestBody(`
          var scopeVar = true && this.startsToOwnling;
          if (scopeVar) {
            this.startsAsUndefined = scopeVar;
          }
          scopeVar;
      `);
      const { this_, scope } = getThisAndScope();
      const result = evaluateProgram(kuery, this_, scope, { verbosity: 0 });
      expect(result)
          .toEqual(entities().ownling);
      expect(getFieldOf(this_, "startsAsUndefined"))
          .toEqual(entities().ownling);
    });

    it("handles || with short-circuit", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, commands);
      const kuery = transpileValaaScriptTestBody(`
          const scopeEarlier = this.startsAsTen;
          var scopeVar = this.startsToOwnling || scopeEarlier;
          if (scopeVar) {
            this.startsAsUndefined = scopeVar;
          }
          this.startsAsUndefined;
      `);
      const { this_, scope } = getThisAndScope();
      const result = evaluateProgram(kuery, this_, scope, { verbosity: 0 });
      expect(result)
          .toEqual(entities().ownling);
      expect(getFieldOf(this_, "startsAsUndefined"))
          .toEqual(entities().ownling);
    });

    it("handles bit shift zero fill right into plain object member", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, commands);
      const kuery = transpileValaaScriptTestBody(`
          let object = { field: 5 >>> 3 };
          this.startsAsUndefined = object.field;
      `);
      const { this_, scope } = getThisAndScope();
      const result = evaluateProgram(kuery, this_, scope, { verbosity: 0 });
      expect(result)
          .toEqual(5 >>> 3);
      expect(getFieldOf(this_, "startsAsUndefined"))
          .toEqual(5 >>> 3);
    });

    it("assigns scope lookups in place of identifiers", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, commands);
      const kuery = transpileValaaScriptTestBody(`
          this.startsAsUndefined = startsAsTen;
      `);
      const { this_, scope } = getThisAndScope({ startsAsTen: 10 });
      const result = evaluateProgram(kuery, this_, scope, { verbosity: 0 });
      expect(result)
          .toEqual(10);
      expect(getFieldOf(this_, "startsAsUndefined"))
          .toEqual(10);
    });

    it("assigns property values in place of this identifiers", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, commands);
      const kuery = transpileValaaScriptTestBody(`
          this.startsAsUndefined = this.startsToOwnling;
      `);
      const { this_, scope } = getThisAndScope();
      const result = evaluateProgram(kuery, this_, scope, { verbosity: 0 });
      expect(result)
          .toEqual(entities().ownling);
      expect(getFieldOf(this_, "startsAsUndefined"))
          .toEqual(entities().ownling);
    });

    it("assigns property values in place of this identifiers (deep 1)", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, commands);
      const kuery = transpileValaaScriptTestBody(`
          this.startsToOwnling.counter = this.startsAsTen;
      `);
      const { this_, scope } = getThisAndScope();
      const result = evaluateProgram(kuery, this_, scope, { verbosity: 0 });
      expect(result)
          .toEqual(10);
      expect(entities().ownling.propertyValue("counter"))
          .toEqual(10);
    });

    it("handles +=", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, commands);
      const kuery = transpileValaaScriptTestBody(`
          this.startsAsTen += 5;
      `);
      const { this_, scope } = getThisAndScope();
      const result = evaluateProgram(kuery, this_, scope, { verbosity: 0 });
      expect(result)
          .toEqual(15);
      expect(getFieldOf(this_, "startsAsTen"))
          .toEqual(15);
    });

    it("handles -=", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, commands);
      const kuery = transpileValaaScriptTestBody(`
          const scopeValue = (this.startsAsTen += 5) + 2;
          scopeValue;
      `);
      const { this_, scope } = getThisAndScope();
      const result = evaluateProgram(kuery, this_, scope, { verbosity: 0 });
      expect(result)
          .toEqual(17);
      expect(getFieldOf(this_, "startsAsTen"))
          .toEqual(15);
    });

    it("handles *=", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, commands);
      const kuery = transpileValaaScriptTestBody(`
          let scopeValue = this.startsAsTen + 2;
          scopeValue *= this.startsToOwnling.ownling_counter;
          this.startsAsUndefined = scopeValue;
          ({ result: this.startsAsUndefined, closure: $fromScope() });
      `);
      // console.log("kuery", dumpify(kuery.toJSON()));
      const { this_, scope } = getThisAndScope();
      const { result, closure } = evaluateProgram(kuery, this_, scope, { verbosity: 0 });
      expect(result)
          .toEqual(120);
      expect(entities().ownling.propertyValue("ownling_counter"))
          .toEqual(10);
      expect(getNativeIdentifierValue(closure.scopeValue))
          .toEqual(120);
    });

    it("handles if statements", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, commands);
      const kuery = transpileValaaScriptTestBody(`
          if (startsAsTen !== startsToOwnling) { this.newValue = 1; } else { this.newValue = 2; }
          this.newValue;
      `);
      const { this_, scope } = getThisAndScope(
          { startsAsTen: 10, startsToOwnling: entities().ownling });
      const result = evaluateProgram(kuery, this_, scope, { verbosity: 0 });
      expect(result)
          .toEqual(1);
      expect(getFieldOf(this_, "newValue"))
          .toEqual(1);
    });
  }

  describe("Property assignment with scope as this and non-existing fields", () => {
    testPropertyByExpressionAssignments(
        valaaScriptBlock, (scope = {}) => ({ this_: scope, scope }),
    );
  });

  describe("Property assignment with Entity as this and with non-existing Property's", () => {
    testPropertyByExpressionAssignments(
        valaaScriptBlock, (scope = {}) => ({ this_: entities().creator, scope }),
    );
  });

  const createCreatorProperties = [
    created({ id: ["creator-startsAsTen"], typeName: "Property", initialState: {
      name: "startsAsTen",
      owner: vRef("creator", "properties"),
      value: literal(10),
    }, }),
    created({ id: ["creator-startsToOwnling"], typeName: "Property", initialState: {
      name: "startsToOwnling",
      owner: vRef("creator", "properties"),
      value: pointer(vRef("ownling")),
    }, }),
    created({ id: ["creator-startsAsUndefined"], typeName: "Property", initialState: {
      name: "startsAsUndefined",
      owner: vRef("creator", "properties"),
      value: null,
    }, }),
  ];

  describe("Property assignment to existing Entity Property's and empty scope", () => {
    const args = [
      valaaScriptBlock.concat(createCreatorProperties),
      (scope = {}) => ({ this_: entities().creator, scope }),
    ];
    testPropertyByExpressionAssignments(...args);
    testStatementOperations(...args);
  });

  function testScopeManipulations (commands, getThisAndScope) {
    it("extracts scope value through identifier", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, commands);
      const kuery = transpileValaaScriptTestBody(`
          startsAsTen;
      `);
      const { this_, scope } = getThisAndScope();
      const result = evaluateProgram(kuery, this_, scope, { verbosity: 0 });
      expect(result)
          .toEqual(10);
    });

    it("sets a scope value through identifier", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, commands);
      const kuery = transpileValaaScriptTestBody(`
          startsAsTen = 20;
      `);
      const { this_, scope } = getThisAndScope({ startsAsTen: createNativeIdentifier(10) });
      const result = evaluateProgram(kuery, this_, scope, { verbosity: 0 });
      expect(result)
          .toEqual(20);
      expect(extractValueFrom(scope.startsAsTen))
          .toEqual(20);
    });

    it("retains the original scope value if a shadowing variable is altered", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, commands);
      const kuery = transpileValaaScriptTestBody(`
          let startsAsTen = 10;
          startsAsTen = 20;
      `);
      const { this_, scope } = getThisAndScope({ startsAsTen: createNativeIdentifier(10) });
      const result = evaluateProgram(kuery, this_, scope, { verbosity: 0 });
      expect(result)
          .toEqual(20);
      expect(extractValueFrom(scope.startsAsTen))
          .toEqual(10);
    });
  }

  describe("Property assignment with scope as this and existing fields", () => {
    const args = [
      valaaScriptBlock,
      (scope = {
        startsAsTen: 10,
        startsToOwnling: entities().ownling,
        startsAsUndefined: null,
      }) => ({ this_: scope, scope }),
    ];
    testPropertyByExpressionAssignments(...args);
    testStatementOperations(...args);
    testScopeManipulations(...args);
  });

  describe("Property assignment to existing Entity Property's and lexical scope", () => {
    const args = [
      valaaScriptBlock.concat(createCreatorProperties),
      () => ({ this_: entities().creator, scope: entities().creator.getLexicalScope() }),
    ];
    testPropertyByExpressionAssignments(...args);
    testStatementOperations(...args);
    testScopeManipulations(...args);
  });

  describe("Regression tests", () => {
    it("array lookup with array length minus 1", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, valaaScriptBlock);
      const bodyKuery = transpileValaaScriptTestBody(`
          const myArray = [0, 1, 2];
          myArray[myArray.length - 1];
      `);
      const lastEntry = entities().creator.do(bodyKuery);
      expect(lastEntry)
          .toEqual(2);
    });
  });
});

describe("@valos/engine - @valos/prophet integrations", () => {
  it("passes a property value to paired client", async () => {
    harness = await createEngineOracleHarness({ verbosity: 0, oracleOptions: {
      testAuthorityConfig: { isRemoteAuthority: true, isLocallyPersisted: true },
    } });
    const pairness = await createEngineOracleHarness({ verbosity: 0, pairedHarness: harness });

    expect(await harness.runBody(vRef("test_partition"), `
      this.val = "yo";
    `)).toEqual("yo");

    await pairness.receiveTruthsFrom(harness);

    expect(pairness.runBody(vRef("test_partition"), `
      this.val;
    `)).toEqual("yo");
  });

  it("passes a property reference to a newly created Entity to paired client", async () => {
    harness = await createEngineOracleHarness({ verbosity: 0, oracleOptions: {
      testAuthorityConfig: { isRemoteAuthority: true, isLocallyPersisted: true },
    } });
    const pairness = await createEngineOracleHarness({ verbosity: 0, pairedHarness: harness });

    expect(await harness.runBody(vRef("test_partition"), `
      this.thing = new Entity({ owner: this, name: "thingie", properties: { val: "yoyo" } });
      this.thing.$V.name;
    `)).toEqual("thingie");

    await pairness.receiveTruthsFrom(harness);

    expect(pairness.runBody(vRef("test_partition"), `
      [this.thing.$V.name, this.thing.val];
    `)).toEqual(["thingie", "yoyo"]);
  });

  it("passes a complex property with a Resource reference to paired client", async () => {
    harness = await createEngineOracleHarness({ verbosity: 0, oracleOptions: {
      testAuthorityConfig: { isRemoteAuthority: true, isLocallyPersisted: true },
    } });
    const pairness = await createEngineOracleHarness({ verbosity: 0, pairedHarness: harness });

    expect(await harness.runBody(vRef("test_partition"), `
      const obj = {
        things: [new Entity({ owner: this, name: "thingie", properties: { val: "yoyo" } })],
      };
      this.lookup = obj;
      obj.things[1] = "local but not universal";
      [
        this.lookup.things[0].$V.name, this.lookup.things[0].val,
        this.lookup.things[1], obj.things[1],
      ];
    `)).toEqual(["thingie", "yoyo", undefined, "local but not universal"]);

    await pairness.receiveTruthsFrom(harness, { verbosity: 0 });

    expect(pairness.runBody(vRef("test_partition"), `
      [
        this.lookup.things[0].$V.name, this.lookup.things[0].val, this.lookup.things[1],
      ];
    `)).toEqual(["thingie", "yoyo", undefined]);
  });

  it("passes a function inside property to paired client", async () => {
    harness = await createEngineOracleHarness({ verbosity: 0, oracleOptions: {
      testAuthorityConfig: { isRemoteAuthority: true, isLocallyPersisted: true },
    } });
    const pairness = await createEngineOracleHarness({ verbosity: 0, pairedHarness: harness });

    const values = await harness.runBody(vRef("test_partition"), `
      const callbackEntity = new Entity({ owner: this, name: "Callback Target",
        properties: { result: 10 },
      });
      const obj = {
        increment: 1,
        callbackEntity: callbackEntity,
        callback: function () {
          return (callbackEntity.result += (this.increment + obj.increment));
        },
      };
      Object.defineProperty(obj, "decrement", { get: function () { return -this.increment; } });
      Object.defineProperty(callbackEntity, "antiresult",
          { get: function () { return -this.result; } });
      const values = [obj.callback()];
      values.push(callbackEntity.result);
      this.obj = obj;
      values.push(obj.increment += 1);
      values.push(obj.callback());
      values.push(this.obj.callback());
      values.push(callbackEntity.result);
      values.push(obj.decrement);
      values.push(callbackEntity.antiresult);
      values.push(obj.callback);
      values;
    `, { scope: { console } });
    expect(values.slice(0, -1))
        .toEqual([12, 12, 2, 16, 18, 18, -2, -18]);
    // expect(values[values.length - 1].call({ increment: 3 }))
    //    .toEqual(23); // this works but it's a pita to await for getLocalEvent
    await pairness.receiveTruthsFrom(harness, { verbosity: 0 });

    const pairedValues = await pairness.runBody(vRef("test_partition"), `
      const values = [this.obj.callbackEntity.result];
      values.push(this.obj.callback());
      values.push(this.$V.unnamedOwnlings[0].result);
      values.push(this.obj.decrement);
      values.push(this.obj.callbackEntity.antiresult);
      values;
    `);
    expect(pairedValues)
        .toEqual([18, 20, 20, undefined /* -1 */, -20]);
    // See VALEK/index.js:94 for missing getter universalization

    await harness.receiveTruthsFrom(harness, { clearUpstreamEntries: true });
    await harness.receiveTruthsFrom(pairness, { clearUpstreamEntries: true });

    expect(await harness.runBody(vRef("test_partition"), `this.obj.callbackEntity.result`))
        .toEqual(20);
  });

  describe("Regressions", () => {
    it("returns $V.partitionURI for root, child, instance and ghosts properly", () => {
      harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true });
      const { rootURI, testURI, instanceURI, ghostURI } = harness.runBody(vRef("test_partition"), `
        const rootURI = this.$V.partitionURI;
        const test = this.$V.unnamedOwnlings.find(e => (e.$V.name === "testName"));
        const instance = this.$V.unnamedOwnlings.find(e => (e.$V.name === "testInstance"));
        const ghost = instance.$V.unnamedOwnlings.find(e => (e.$V.name === "ownlingCreator"));
        ({
          rootURI: this.$V.partitionURI,
          testURI: test.$V.partitionURI,
          instanceURI: instance.$V.partitionURI,
          ghostURI: ghost.$V.partitionURI,
        });
      `);
      expect(rootURI).toEqual(String(harness.testPartitionURI));
      expect(testURI).toEqual(String(harness.testPartitionURI));
      expect(instanceURI).toEqual(String(harness.testPartitionURI));
      expect(ghostURI).toEqual(String(harness.testPartitionURI));
    });
  });
});
