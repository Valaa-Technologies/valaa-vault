Object.defineProperty(exports, "__esModule", { value: true });

const { dumpObject, wrapError } = require("./wrapError");

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

module.exports = {
  mapEagerly,
  thenChainEagerly,
  thisChainEagerly,
};

// Sequential map on maybeThenable which awaits for each entry and each
// return value of the mapped function eagerly: if no thenables are
// encountered resolves synchronously.

function mapEagerly (
    entriesOrThenables, // : any[] | Promise<any[]>,
    callback, // : Function,
    onRejected, // ?: Function,
    startIndex = 0,
    results = []) {
  let index = null;
  let wrap;
  let entries;
  try {
    if (!Array.isArray(entriesOrThenables)) {
      if ((entriesOrThenables == null) || (typeof entriesOrThenables.then !== "function")) {
        throw new Error("mapEagerly: array expected as first argument");
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

function thenChainEagerly (
    initialValue, // : any,
    functions, // : any | Function[],
    onRejected, // : ?Function,
    startIndex // : number
) {
  const functionChain = (startIndex !== undefined) || Array.isArray(functions) ? functions
      : [functions];
  let next = initialValue;
  let index = startIndex || 0;
  let head;
  for (; (next == null) || (typeof next.then !== "function"); ++index) {
    head = next;
    try {
      if (index >= functionChain.length) return head;
      const func = functionChain[index];
      next = !func ? head : func(head);
    } catch (error) {
      const wrapped = wrapError(error, new Error(getName("callback")),
          "\n\thead:", ...dumpObject(head),
          "\n\tcurrent function:", ...dumpObject(functionChain[index]),
          "\n\tfunctionChain:", ...dumpObject(functionChain));
      if (!onRejected) throw wrapped;
      next = onRejected(wrapped, index, head, functionChain, onRejected);
    }
  }
  --index;
  return next.then(
      newHead => (index + 1 >= functionChain.length
          ? newHead
          : thenChainEagerly(newHead, functionChain, onRejected, index + 1)),
      error => {
        const wrapped = wrapError(error, new Error(getName("thenable resolution")),
            "\n\thead:", ...dumpObject(head),
            "\n\tcurrent function:", ...dumpObject(functionChain[index]),
            "\n\tfunctionChain:", ...dumpObject(functionChain));
        if (!onRejected) throw wrapped;
        return onRejected(wrapped, index, head, functionChain, onRejected);
      });
  function getName (info) {
    return `During thenChainEagerly ${index === -1 ? "initial value" : `#${index}`} ${info} ${
        !(onRejected && onRejected.name) ? " " : `(with ${onRejected.name})`}`;
  }
}

function thisChainEagerly (
    this_, // : any,
    initialParams, // : any,
    functions, // : any | Function[],
    onRejected, // : ?Function,
    startIndex // : number
) {
  let index = startIndex || 0, params = initialParams;
  let arrayPromise;
  for (;;) {
    if ((params == null) || (typeof params !== "object")) {
      params = (params === undefined) ? [] : [params];
    } else if (Array.isArray(params)) {
      for (let i = 0; i !== params.length; ++i) {
        if ((params[i] != null) && (typeof params[i].then === "function")) {
          params = Promise.all(arrayPromise = params);
          break;
        }
      }
      if (typeof params.then === "function") break;
    } else if (typeof params.then === "function") break;
    else {
      const keys = Object.keys(params);
      if (keys.length !== 1) {
        throw new Error("thisChainEagerly redirection object must have exactly one field");
      }
      const forward = keys[0];
      params = params[forward];
      let lookup = functions[forward];
      if (typeof lookup === "number") index = lookup;
      else if (typeof lookup === "function") index = Number(forward);
      else {
        lookup = !forward ? functions.length : functions.findIndex(f => (f.name === forward));
        if (lookup === -1) {
          throw new Error(`thisChainEagerly can't find rediction function with name '${forward}'`);
        }
        index = functions[forward] = lookup;
      }
      continue;
    }
    if (index >= functions.length) return params;
    const func = functions[index];
    if (!func) continue;
    try {
      params = func.apply(this_, params);
      ++index;
    } catch (error) {
      const wrapped = wrapError(error, new Error(getName("callback")),
          "\n\tthis:", ...dumpObject(this_),
          "\n\tparams:", ...dumpObject(params),
          "\n\tcurrent function:", ...dumpObject(func),
          "\n\tfunctions:", ...dumpObject(functions));
      if (!onRejected) throw wrapped;
      params = onRejected.call(this_, wrapped, index, params, functions, onRejected);
      index = functions.length;
    }
  }
  --index;
  return params.then(
      newParams => thisChainEagerly(this_, newParams, functions, onRejected, index + 1),
      error => {
        const wrapped = wrapError(error, new Error(getName("thenable resolution")),
            "\n\tthis:", ...dumpObject(this_),
            "\n\tparams:", ...dumpObject(params),
            "\n\tcurrent function:", ...dumpObject(functions[index]),
            "\n\tfunctions:", ...dumpObject(functions),
            "\n\tonRejected:", ...dumpObject(onRejected),
        );
        if (!onRejected) throw wrapped;
        return thisChainEagerly(this_,
            onRejected.call(this_, wrapped, index, arrayPromise || params, functions, onRejected),
            functions, onRejected, functions.length);
      });
  function getName (info) {
    return `During thenChainEagerly ${index === -1 ? "initial params" : `#${index}`} ${info} ${
        !(onRejected && onRejected.name) ? "(no handler)" : `(with ${onRejected.name})`}`;
  }
}
