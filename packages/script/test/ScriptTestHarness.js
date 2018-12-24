// @flow

import { tryHostRef } from "~/raem/VALK/hostReference";
import RAEMTestHarness, { createRAEMTestHarness } from "~/raem/test/RAEMTestHarness";

import ScriptTestAPI from "~/script/test/ScriptTestAPI";
import { Kuery, builtinSteppers } from "~/script/VALSK";
import { transpileValaaScriptBody } from "~/script/transpileValaaScript";

export function createScriptTestHarness (options: Object, ...commandBlocks: any) {
  return createRAEMTestHarness({
    name: "Script Test Harness", ContentAPI: ScriptTestAPI, TestHarness: ScriptTestHarness,
    corpusOptions: { builtinSteppers },
    ...options,
  }, ...commandBlocks);
}

export default class ScriptTestHarness extends RAEMTestHarness {
  runBody (self: any, valaaScriptBody: string, options: Object = {}) {
    const bodyKuery = transpileValaaScriptBody(valaaScriptBody, {
      verbosity: options.verbosity || 0,
      customVALK: this.ContentAPI.VALK,
      sourceInfo: options.sourceInfo,
    });
    options.transaction = this.valker.acquireTransaction("test-run-body");
    const selfMaybeRef = tryHostRef(self) || self;
    (options.scope || (options.scope = {})).this = selfMaybeRef;
    const ret = this.run(selfMaybeRef, bodyKuery, options);
    if (options.transaction) {
      const result = options.transaction.releaseTransaction();
      if (result) return Promise.resolve(result.getLocalEvent()).then(() => ret);
    }
    return ret;
  }
}

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
  const harness = createScriptTestHarness({ verbosity: options.verbosity }, ...commandBlocks);
  if (options.harness) Object.setPrototypeOf(options.harness, harness);
  if (scope) {
    options.scope = scope;
    scope.this = head;
  }
  return harness.run(head, programKuery, options);
}
