/* global describe expect it */

import { created } from "~/raem/events";
import { vRef } from "~/raem/VRL";

import { createNativeIdentifier, getNativeIdentifierValue, transpileValoscriptBody }
    from "~/script";

import Vrapper from "~/engine/Vrapper";
import { createEngineTestHarness } from "~/engine/test/EngineTestHarness";
import { clearAllScribeDatabases } from "~/sourcerer/test/SourcererTestHarness";
import VALEK, { Kuery, literal, pointer } from "~/engine/VALEK";

const valoscriptBlock = [
  created({ id: ["creator-myFunc"], typeName: "Property", initialState: {
    name: "myFunc", owner: vRef("creator", "properties"),
    value: literal(VALEK.doStatements(VALEK.apply(
        VALEK.fromScope("propertyCallback").notNull(), VALEK.fromScope("this"))).toJSON()),
  }, }),
];

let harness: { createds: Object, engine: Object, sourcerer: Object, testEntities: Object };
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
 * @param {VRL}   thisReference
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

function transpileValoscriptTestBody (bodyText: string) {
  return transpileValoscriptBody(bodyText, { customVALK: VALEK });
}

describe("Manipulating existing variables", () => {
  it("assigns existing Resource property variable with 'counter = 75' when valked", () => {
    harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, valoscriptBlock);
    const bodyKuery = transpileValoscriptTestBody(`
        counter = 75;
    `);
    const updatedCounter = entities().creator.do(bodyKuery, { verbosity: 0 });
    expect(updatedCounter)
        .toEqual(75);
    expect(entities().creator.step(VALEK.propertyLiteral("counter")))
        .toEqual(75);
  });
});

describe("delete operator", () => {
  it("deletes a native object property, but doesn't propagate to prototype properties", () => {
    harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, valoscriptBlock);
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
    const bodyKuery = transpileValoscriptTestBody(programText);
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
    harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, valoscriptBlock);
    const bodyKuery = transpileValoscriptTestBody(`
        counter = 75;
    `);
    const updatedCounter = entities().creator.do(bodyKuery, { verbosity: 0 });
    expect(updatedCounter)
        .toEqual(75);
    expect(entities().creator.step(VALEK.propertyLiteral("counter")))
        .toEqual(75);
  });

  it("returns undefined for typeof identifiers which are missing, instead of throwing", () => {
    harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, valoscriptBlock);
    const bodyKuery = transpileValoscriptTestBody(`
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
    const kuery = transpileValoscriptTestBody(`
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
    const kuery = transpileValoscriptTestBody(`
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
    const kuery = transpileValoscriptTestBody(`
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
    const kuery = transpileValoscriptTestBody(`
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
    const kuery = transpileValoscriptTestBody(`
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
    const kuery = transpileValoscriptTestBody(`
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
    const kuery = transpileValoscriptTestBody(`
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
    const kuery = transpileValoscriptTestBody(`
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
    const kuery = transpileValoscriptTestBody(`
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
    const kuery = transpileValoscriptTestBody(`
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
    const kuery = transpileValoscriptTestBody(`
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
    const kuery = transpileValoscriptTestBody(`
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
    const kuery = transpileValoscriptTestBody(`
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
    const kuery = transpileValoscriptTestBody(`
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
    const kuery = transpileValoscriptTestBody(`
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
    const kuery = transpileValoscriptTestBody(`
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
    const kuery = transpileValoscriptTestBody(`
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
    const kuery = transpileValoscriptTestBody(`
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
    const kuery = transpileValoscriptTestBody(`
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
    const kuery = transpileValoscriptTestBody(`
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
    const kuery = transpileValoscriptTestBody(`
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
    const kuery = transpileValoscriptTestBody(`
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
    const kuery = transpileValoscriptTestBody(`
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
    const kuery = transpileValoscriptTestBody(`
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
    const kuery = transpileValoscriptTestBody(`
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
    const kuery = transpileValoscriptTestBody(`
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
    const kuery = transpileValoscriptTestBody(`
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
    const kuery = transpileValoscriptTestBody(`
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
    const kuery = transpileValoscriptTestBody(`
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
    const kuery = transpileValoscriptTestBody(`
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
    const kuery = transpileValoscriptTestBody(`
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
    const kuery = transpileValoscriptTestBody(`
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
    const kuery = transpileValoscriptTestBody(`
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
    const kuery = transpileValoscriptTestBody(`
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
    const kuery = transpileValoscriptTestBody(`
        let scopeValue = this.startsAsTen + 2;
        scopeValue *= this.startsToOwnling.ownling_counter;
        this.startsAsUndefined = scopeValue;
        ({ result: this.startsAsUndefined, closure: $fromScope() });
    `);
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
    const kuery = transpileValoscriptTestBody(`
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
      valoscriptBlock, (scope = {}) => ({ this_: scope, scope }),
  );
});

describe("Property assignment with Entity as this and with non-existing Property's", () => {
  testPropertyByExpressionAssignments(
      valoscriptBlock, (scope = {}) => ({ this_: entities().creator, scope }),
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
    valoscriptBlock.concat(createCreatorProperties),
    (scope = {}) => ({ this_: entities().creator, scope }),
  ];
  testPropertyByExpressionAssignments(...args);
  testStatementOperations(...args);
});

function testScopeManipulations (commands, getThisAndScope) {
  it("extracts scope value through identifier", () => {
    harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, commands);
    const kuery = transpileValoscriptTestBody(`
        startsAsTen;
    `);
    const { this_, scope } = getThisAndScope();
    const result = evaluateProgram(kuery, this_, scope, { verbosity: 0 });
    expect(result)
        .toEqual(10);
  });

  it("sets a scope value through identifier", () => {
    harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, commands);
    const kuery = transpileValoscriptTestBody(`
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
    const kuery = transpileValoscriptTestBody(`
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
    valoscriptBlock,
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
    valoscriptBlock.concat(createCreatorProperties),
    () => ({ this_: entities().creator, scope: entities().creator.getValospaceScope() }),
  ];
  testPropertyByExpressionAssignments(...args);
  testStatementOperations(...args);
  testScopeManipulations(...args);
});

describe("Regression tests", () => {
  it("array lookup with array length minus 1", () => {
    harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, valoscriptBlock);
    const bodyKuery = transpileValoscriptTestBody(`
        const myArray = [0, 1, 2];
        myArray[myArray.length - 1];
    `);
    const lastEntry = entities().creator.do(bodyKuery);
    expect(lastEntry)
        .toEqual(2);
  });
  it("sorts an array containing resources by their name using localCompare comparator", () => {
    harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, valoscriptBlock);
    const bodyKuery = transpileValoscriptTestBody(`
      const sortFunction = (a,b) => a[valos.name].localeCompare(b[valos.name]);
      const seq = [
        new Entity({ name: "foo", owner: this }),
        new Entity({ name: "bar", owner: this }),
      ];
      seq.sort(sortFunction);
    `);
    const sorted = entities().creator.do(bodyKuery, { verbosity: 0 });
    expect(sorted.length)
        .toEqual(2);
    expect(sorted[0].step("name")).toEqual("bar");
    expect(sorted[1].step("name")).toEqual("foo");
  });
  it("sorts an array containing Property resources by using localCompare comparator", () => {
    harness = createEngineTestHarness({ verbosity: 0, claimBaseBlock: true }, valoscriptBlock);
    const bodyKuery = transpileValoscriptTestBody(`
      const sortFunction = (a,b) => a[valos.name].localeCompare(b[valos.name]);
      const resource = new Entity({ owner: this, properties: { foo: 1, bar: 0 } });
      ({
        original: resource[valos.properties],
        sorted: [].concat(resource[valos.properties]).sort(sortFunction),
      });
    `);
    const { original, sorted } = entities().creator.do(bodyKuery, { verbosity: 0 });
    expect(original.length)
        .toEqual(2);
    expect(original[0].step("name")).toEqual("foo");
    expect(original[1].step("name")).toEqual("bar");
    expect(sorted.length)
        .toEqual(2);
    expect(sorted[0].step("name")).toEqual("bar");
    expect(sorted[1].step("name")).toEqual("foo");
  });
});
