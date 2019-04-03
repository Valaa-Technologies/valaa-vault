// @flow

import { dumpObject, wrapError } from "~/tools/wrapError";
import { invariantifyArray } from "~/tools/invariantify";

/**
 * Resolves the chain of then-operations eagerly ie. synchronously if
 * possible. If any of the intermediate steps is a thenable, the whole
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
 * Rationale: in ValOS codebase there are pathways which sometimes need
 * to work synchronously and sometimes asynchronously, depending on
 * what data can be known to be cached or not.
 * While 'await' keyword can accept non-thenable values just fine the
 * issue is that declaring a function to be 'async' means that it will
 * always return a thenable: this means that synchronous callers will be
 * broken. Changing synchronous callers to use await or deal with
 * thenables has cascading changes to the surrounding contexts which
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

// Sequential map on maybeThenable which awaits for each entry and each
// return value of the mapped function eagerly: if no thenables are
// encountered resolves synchronously.
export function mapEagerly (entriesOrThenables: any[] | Promise<any[]>, callback: Function,
    onRejected?: Function, startIndex: number = 0, results: Array<any> = []) {
  let index = null;
  let wrap;
  let entries;
  try {
    if (!Array.isArray(entriesOrThenables)) {
      if ((entriesOrThenables == null) || (typeof entriesOrThenables.then !== "function")) {
        invariantifyArray(entriesOrThenables, "mapEagerly.entriesOrThenables");
      }
      wrap = new Error(`During mapEagerly.entriesOrThenables.catch`);
      return entriesOrThenables.then(
          entries_ => mapEagerly(entries_, callback, onRejected, startIndex, results),
          errorOnMapEagerly);
    }
    entries = entriesOrThenables;
    let valueCandidate;
    for (index = startIndex;
        index < entries.length;
        results[index++] = valueCandidate) {
      const head = entries[index];
      if ((head == null) || (typeof head.then !== "function")) {
        try {
          valueCandidate = callback(head, index, entries);
        } catch (error) {
          wrap = new Error(getName("callback"));
          return errorOnMapEagerly(error);
        }
        if ((valueCandidate == null) || (typeof valueCandidate.then !== "function")) continue;
        wrap = new Error(getName("callback thenable resolution"));
      } else {
        // eslint-disable-next-line no-loop-func
        valueCandidate = head.then(resolvedHead => callback(resolvedHead, index, entries));
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
            index, results, entries, callback, onRejected);
      }
    } catch (onRejectedError) { innerError = onRejectedError; }
    throw wrapError(innerError, wrap,
        "\n\tmaybePromises:", ...dumpObject(entries || entriesOrThenables),
        "\n\tcurrent entry:", ...dumpObject((entries || entriesOrThenables || [])[index]));
  }
}

export default function thenChainEagerly (initialValue: any, functions: any | Function[],
    onRejected: ?Function, startIndex: number) {
  const functionChain = (startIndex !== undefined) || Array.isArray(functions) ? functions
      : [functions];
  let next = initialValue;
  let index = startIndex || 0;
  let wrap;
  let head;
  for (; (next == null) || (typeof next.then !== "function"); ++index) {
    head = next;
    try {
      if (index >= functionChain.length) return head;
      const func = functionChain[index];
      next = !func ? head : func(head);
    } catch (error) {
      wrap = new Error(getName("callback"));
      next = errorOnThenChainEagerly(error);
    }
  }
  --index;
  return next.then(
      newHead => (index + 1 >= functionChain.length
          ? newHead
          : thenChainEagerly(newHead, functionChain, onRejected, index + 1)),
      errorOnThenChainEagerly);
  function getName (info) {
    return `During thenChainEagerly ${index === -1 ? "initial value" : `#${index}`} ${info} ${
        !(onRejected && onRejected.name) ? " " : `(with ${onRejected.name})`}`;
  }
  function errorOnThenChainEagerly (error) {
    const wrapped = wrapError(error, wrap || new Error(getName("thenable resolution")),
        "\n\thead:", ...dumpObject(head),
        "\n\tcurrent function:", ...dumpObject(functionChain[index]),
        "\n\tfunctionChain:", ...dumpObject(functionChain));
    if (!onRejected) throw wrapped;
    return onRejected(wrapped, index, head, functionChain);
  }
}
