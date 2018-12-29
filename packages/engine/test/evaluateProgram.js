// @flow

import type { Kuery } from "~/engine/VALEK";
import type ValaaEngine from "~/engine/ValaaEngine";

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
export default function evaluateProgram (engine: ValaaEngine, programKuery: Kuery, head: any,
    scope: ?Object, options: Object = {}) {
  if (scope) {
    options.scope = scope;
    scope.this = head;
  }
  return engine.run(head, programKuery, options);
}
