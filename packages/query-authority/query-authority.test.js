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
    expect(entities().creator.get(VALEK.propertyLiteral("counter")))
        .toEqual(75);
  });
});
