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
export function mapEagerly (maybePromiseToEntries: any[] | Promise<any[]>, callback: Function,
    onRejected?: Function, startIndex: number = 0, results: Array<any> = []) {
  let index = null;
  let wrap;
  let entries;
  try {
    if (!Array.isArray(maybePromiseToEntries)) {
      if (!isPromise(maybePromiseToEntries)) {
        invariantifyArray(maybePromiseToEntries, "mapEagerly.maybePromises");
      }
      wrap = new Error(`During mapEagerly.maybePromises.catch`);
      return maybePromiseToEntries.then(
          entries_ => mapEagerly(entries_, callback, onRejected, startIndex, results),
          errorOnMapEagerly);
    }
    entries = maybePromiseToEntries;
    let valueCandidate;
    for (index = startIndex;
        index < entries.length;
        results[index++] = valueCandidate) {
      const head = entries[index];
      if (!isPromise(head)) {
        try {
          valueCandidate = callback(head, index, entries);
        } catch (error) {
          wrap = new Error(getName("callback"));
          return errorOnMapEagerly(error);
        }
        if (!isPromise(valueCandidate)) continue;
        wrap = new Error(getName("callback promise resolution"));
      } else {
        valueCandidate = head.then(resolvedHead => callback(resolvedHead, index, entries)); // eslint-disable-line no-loop-func
        wrap = new Error(getName("head or callback promise resolution"));
      }
      return valueCandidate.then(
          value => { // eslint-disable-line no-loop-func
            results[index] = value;
            return mapEagerly(entries, callback, onRejected, index + 1, results);
          },
          errorOnMapEagerly);
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
            (index === null) ? entries : entries[index],
            index, results, entries);
      }
    } catch (onRejectedError) { innerError = onRejectedError; }
    throw wrapError(innerError, wrap,
        "\n\tmaybePromises:", ...dumpObject(entries || maybePromiseToEntries),
        "\n\tcurrent entry:", ...dumpObject((entries || maybePromiseToEntries || [])[index]));
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
