// @flow

import RAEMTestHarness, { createRAEMTestHarness } from "~/raem/test/RAEMTestHarness";
import ScriptTestAPI from "~/script/test/ScriptTestAPI";
import { Kuery, builtinSteppers } from "~/script/VALSK";

export function createScriptTestHarness (options: Object, ...proclamationBlocks: any) {
  return createRAEMTestHarness({
    name: "Script Test Harness", ContentAPI: ScriptTestAPI, TestHarness: ScriptTestHarness,
    corpusOptions: { builtinSteppers },
    ...options,
  }, ...proclamationBlocks);
}

export default class ScriptTestHarness extends RAEMTestHarness {}

/**
 * Calls given expressionKuery against given corpus, setting given thisReference as the call this
 * and given scope as the lexical scope of the call.
 *
 * @param {any}    corpus
 * @param {Kuery}  programKuery
 * @param {VRef}   thisReference
 * @param {Object} scope
 * @returns                       the resulting value of the expressionKuery
 */
export function evaluateTestProgram (proclamationBlocks: any = [],
    head: any, programKuery: Kuery, scope: ?Object, options: Object = {}) {
  const harness = createScriptTestHarness({ debug: options.debug }, ...proclamationBlocks);
  if (options.harness) Object.setPrototypeOf(options.harness, harness);
  if (scope) {
    options.scope = scope;
    scope.this = head;
  }
  return harness.run(head, programKuery, options);
}
