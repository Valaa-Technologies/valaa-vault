// @flow

import isPromise from "~/tools/isPromise";
import { arrayFromAny } from "~/tools/sequenceFromAny";
import wrapError, { dumpObject } from "~/tools/wrapError";
import { invariantifyArray } from "~/tools/invariantify";

/**
 * Resolves the chain of then-operations eagerly ie. synchronously if
 * possible. If any of the intermediate steps is a promise, the whole
 * operation behaves like so:
 *
 * return functionChain.reduce(async (intermediate, f) => f(await intermediate), initialValue)
 *
 * Otherwise thenChainEagerly returns the result synchronously, like so:
 *
 * return functionChain.reduce((intermediate, f) => f(intermediate), initialValue)
 *
 * Additionally, if any of the steps throws (synchronously or
 * asynchronously) the thrown error is wrapped with context
 * information. If onRejected is given it will be called with the
 * wrapped error and current chain progress information: the return
 * value will be returned from the whole call or a thrown value
 * wrapped in context like above.
 *
 * Rationale: in Valaa codebase there are pathways which sometimes need
 * to work synchronously and sometimes asynchronously, depending on
 * what data can be known to be cached or not.
 * While 'await' keyword can accept non-promise values just fine the
 * issue is that declaring a function to be 'async' means that it will
 * always return a Promise: this means that synchronous callers will be
 * broken. Changing synchronous callers to use await or deal with
 * promises has cascading changes to the surrounding contexts which
 * would lead to larger rewrites.
 *
 * thenChainEagerly solves this problem by retaining the synchronous
 * callsites unchanged with the expense of necessitating the internal
 * sync/async hybrid callpaths to use the somewhat clunkier
 * thenChainEagerly API, instead of the nicer async/await.
 *
 * @export
 * @param {any} head
 * @param {any} callbacks
 * @param {any} onError(error, stepIndex, head, callbacks)
 */

// Sequential map on maybePromises which awaits for each entry and each
// return value of the mapped function eagerly: if no promises are
// encountered resolves synchronously.
export function mapEagerly (maybePromises: any[], callback: Function, onRejected?: Function,
    startIndex: number = 0, results: Array<any> = []) {
  let currentIndex = startIndex;
  try {
    if (!Array.isArray(maybePromises)) {
      if (isPromise(maybePromises)) {
        return maybePromises.then(
            inner => mapEagerly(inner, callback, onRejected, startIndex, results),
            error => errorOnMapEagerly(error, new Error(`During mapEagerly.maybePromises.catch`)));
      }
      invariantifyArray(maybePromises, "mapEagerly.maybePromises");
    }
    for (; currentIndex < maybePromises.length; ++currentIndex) {
      const maybeValue = maybePromises[currentIndex];
      if (!isPromise(maybeValue)) {
        results[currentIndex] = callback(maybeValue, currentIndex, maybePromises);
        if (!isPromise(results[currentIndex])) continue;
      } else {
        results[currentIndex] = maybeValue.then(
            (value) => callback(value, currentIndex, maybePromises)); // eslint-disable-line
      }
      return results[currentIndex].then(
          (value) => { // eslint-disable-line
            results[currentIndex] = value;
            return mapEagerly(maybePromises, callback, onRejected, currentIndex + 1, results);
          },
          (error) => errorOnMapEagerly( // eslint-disable-line
              error, new Error(`During mapEagerly step #${currentIndex}`)),
      );
    }
    return results;
  } catch (error) {
    return errorOnMapEagerly(error, new Error(`During mapEagerly step #${currentIndex}`));
  }
  function errorOnMapEagerly (error, errorWrap) {
    let innerError = error;
    try {
      if (onRejected) {
        return onRejected(error, maybePromises[currentIndex], currentIndex, results, maybePromises);
      }
    } catch (onRejectedError) { innerError = onRejectedError; }
    throw wrapError(innerError, errorWrap,
        "\n\tmaybePromises:", ...dumpObject(maybePromises),
        "\n\tcurrent entry:", ...dumpObject((maybePromises || [])[currentIndex]));
  }
}

export default function thenChainEagerly (initialValue: any, functions: any | Function[],
    onRejected: ?Function, startIndex: number) {
  const functionChain = (startIndex !== undefined) ? functions : arrayFromAny(functions);
  let head = initialValue;
  let currentIndex = startIndex || 0;
  try {
    for (; !isPromise(head); ++currentIndex) {
      if (currentIndex >= functionChain.length) return head;
      head = functionChain[currentIndex](head);
    }
  } catch (error) {
    return errorOnThenChainEagerly(
        error, new Error(`During thenChainEagerly step #${currentIndex}`));
  }
  return head.then(
      value => (currentIndex >= functionChain.length
          ? value
          : thenChainEagerly(
              functionChain[currentIndex](value), functionChain, onRejected, currentIndex + 1)),
      (error) => errorOnThenChainEagerly(
          error, new Error(`During thenChainEagerly step #${currentIndex}`)));
  function errorOnThenChainEagerly (error, errorWrap) {
    let innerError = error;
    try {
      if (onRejected) return onRejected(error, currentIndex, head, functionChain);
    } catch (onRejectedError) { innerError = onRejectedError; }
    throw wrapError(innerError, errorWrap,
        "\n\thead:", ...dumpObject(head),
        "\n\tcurrent function:", ...dumpObject(functionChain[currentIndex]),
        "\n\tfunctionChain:", ...dumpObject(functionChain));
  }
}
