// @flow

import CoreTestHarness, { createCoreTestHarness } from "~/valaa-core/test/CoreTestHarness";
import ScriptTestAPI from "~/valaa-script/test/ScriptTestAPI";
import { Kuery, builtinSteppers } from "~/valaa-script/VALSK";

export function createScriptTestHarness (options: Object, ...commandBlocks: any) {
  return createCoreTestHarness({
    name: "Script Test Harness", ContentAPI: ScriptTestAPI, TestHarness: ScriptTestHarness,
    corpusOptions: { builtinSteppers },
    ...options,
  }, ...commandBlocks);
}

export default class ScriptTestHarness extends CoreTestHarness {}

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
export function evaluateTestProgram (commandBlocks: any = [],
    head: any, programKuery: Kuery, scope: ?Object, options: Object = {}) {
  const harness = createScriptTestHarness({ debug: options.debug }, ...commandBlocks);
  if (options.harness) Object.setPrototypeOf(options.harness, harness);
  if (scope) {
    options.scope = scope;
    scope.this = head;
  }
  return harness.run(head, programKuery, options);
}
