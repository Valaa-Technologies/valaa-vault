// @flow

import isPromise from "~/tools/isPromise";
import { arrayFromAny } from "~/tools/sequenceFromAny";
import wrapError, { dumpObject, outputError } from "~/tools/wrapError";
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
  let index = null;
  let wrap;
  try {
    if (!Array.isArray(maybePromises)) {
      if (!isPromise(maybePromises)) {
        invariantifyArray(maybePromises, "mapEagerly.maybePromises");
      }
      wrap = new Error(`During mapEagerly.maybePromises.catch`);
      return maybePromises.then(
          inner => mapEagerly(inner, callback, onRejected, startIndex, results),
          errorOnMapEagerly);
    }
    for (index = startIndex; index < maybePromises.length; ++index) {
      const maybeValue = maybePromises[index];
      if (!isPromise(maybeValue)) {
        try {
          results[index] = callback(maybeValue, index, maybePromises);
        } catch (error) {
          wrap = new Error(getName("callback"));
          results[index] = errorOnMapEagerly(error);
        }
        if (!isPromise(results[index])) continue;
        wrap = new Error(getName("callback promise resolution"));
      } else {
        results[index] = maybeValue.then((value) => callback(value, index, maybePromises)); // eslint-disable-line
        wrap = new Error(getName("head or callback promise resolution"));
      }
      return results[index]
          .catch(errorOnMapEagerly)
          .then(value => { // eslint-disable-line
            results[index] = value;
            return mapEagerly(maybePromises, callback, onRejected, index + 1, results);
          });
    }
    return results;
  } catch (error) {
    wrap = new Error(getName("handling"));
    return errorOnMapEagerly(error);
  }
  function getName (info) {
    return `During mapEagerly step #${index} ${info} ${
        !(onRejected && onRejected.name) ? " " : `(with ${onRejected.name})`}`;
  }
  function errorOnMapEagerly (error) {
    let innerError = error;
    try {
      if (onRejected) {
        return onRejected(error,
            (index === null) ? maybePromises : maybePromises[index],
            index, results, maybePromises);
      }
    } catch (onRejectedError) { innerError = onRejectedError; }
    throw wrapError(innerError, wrap,
        "\n\tmaybePromises:", ...dumpObject(maybePromises),
        "\n\tcurrent entry:", ...dumpObject((maybePromises || [])[index]));
  }
}

export default function thenChainEagerly (initialValue: any, functions: any | Function[],
    onRejected: ?Function, startIndex: number) {
  const functionChain = (startIndex !== undefined) ? functions : arrayFromAny(functions);
  let next = initialValue;
  let index = startIndex || 0;
  let wrap;
  let head;
  for (; !isPromise(next); ++index) {
    head = next;
    try {
      if (index >= functionChain.length) return head;
      next = functionChain[index](head);
    } catch (error) {
      wrap = new Error(getName("callback"));
      next = errorOnThenChainEagerly(error);
    }
  }
  --index;
  wrap = new Error(getName("promise resolution"));
  return next.then(
      newHead => (++index >= functionChain.length
          ? newHead
          : thenChainEagerly(newHead, functionChain, onRejected, index)),
      errorOnThenChainEagerly);
  function getName (info) {
    return `During thenChainEagerly ${index === -1 ? "initial value" : `#${index}`} ${info} ${
        !(onRejected && onRejected.name) ? " " : `(with ${onRejected.name})`}`;
  }
  function errorOnThenChainEagerly (error) {
    const wrapped = wrapError(error, wrap,
        "\n\thead:", ...dumpObject(head),
        "\n\tcurrent function:", ...dumpObject(functionChain[index]),
        "\n\tfunctionChain:", ...dumpObject(functionChain));
    if (!onRejected) throw wrapped;
    return onRejected(wrapped, index, head, functionChain);
  }
}
