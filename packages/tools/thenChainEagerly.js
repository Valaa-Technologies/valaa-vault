Object.defineProperty(exports, "__esModule", { value: true });

const { dumpObject, wrapError, outputError } = require("./wrapError");

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
  thisChainRedirect,
  thisChainReturn,
  wrapOutputError,
};

// Sequential map on maybeThenable which awaits for each entry and each
// return value of the mapped function eagerly: if no thenables are
// encountered resolves synchronously.

function mapEagerly (
    entriesOrThenables, // : any[] | Promise<any[]>,
    callbacks, // : Function,
    onRejected, // ?: Function,
    startIndex = 0,
    results = []) {
  let index = null;
  let contextName, entries, entryHead, valueCandidate;
  const callback = (typeof callbacks === "function")
      ? callbacks
      : (e => thenChainEagerly(e, callbacks));
  if (!Array.isArray(entriesOrThenables)) {
    if ((entriesOrThenables == null) || (typeof entriesOrThenables.then !== "function")) {
      throw new Error("mapEagerly: array expected as first argument");
    }
    contextName = new Error(`mapEagerly.entriesOrThenables.catch`);
    return entriesOrThenables.then(
        entries_ => mapEagerly(entries_, callback, onRejected, startIndex, results),
        errorOnMapEagerly);
  }
  try {
    entries = entriesOrThenables;
    for (index = startIndex;
        index < entries.length;
        results[index++] = valueCandidate) {
      entryHead = entries[index];
      if ((entryHead == null) || (typeof entryHead.then !== "function")) {
        try {
          valueCandidate = callback(entryHead, index, entries);
        } catch (error) {
          contextName = new Error(getName("callback"));
          return errorOnMapEagerly(error);
        }
        if ((valueCandidate == null) || (typeof valueCandidate.then !== "function")) continue;
        contextName = new Error(getName("callback thenable resolution"));
      } else {
        // eslint-disable-next-line no-loop-func
        valueCandidate = entryHead.then(resolvedHead => callback(resolvedHead, index, entries));
        contextName = new Error(getName("head or callback promise resolution"));
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
    contextName = new Error(getName("handling"));
    return errorOnMapEagerly(error);
  }
  function getName (info) {
    return `mapEagerly step #${index} ${info} ${
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
    throw wrapError(innerError, contextName,
        "\n\tentry head:", ...dumpObject(entryHead, { nest: 0 }),
        "\n\tmaybePromises:", ...dumpObject(entries || entriesOrThenables),
        "\n\tcurrent entry:", ...dumpObject((entries || entriesOrThenables || [])[index]));
  }
}

function thenChainEagerly (
    initialValue, // : any,
    functions, // : any | Function[],
    onRejected, // : ?Function,
    startIndex, // : number
    errorDetailLevel = 2, // : number
) {
  const functionChain = (startIndex !== undefined) || Array.isArray(functions) ? functions
      : [functions];
  let index = startIndex || 0;
  let next = initialValue;
  let head, contextName;
  for (; (next == null) || (typeof next.then !== "function"); ++index) {
    head = next;
    try {
      if (index >= functionChain.length) return head;
      const func = functionChain[index];
      next = !func ? head : func(head);
    } catch (error) {
      contextName = new Error("callback call");
      next = onThenChainError(error);
      // TODO(iridian, 2021-03): Fix the inconsistency here between
      // thisChain, which sets index to functions.length (thus returning)
      // and thenChain behavior here, which continues to next chain.
    }
  }
  --index;
  contextName = (errorDetailLevel != null) && new Error("thenable resolution");
  return next.then(
      newHead =>
          (index + 1 >= functionChain.length
              ? newHead
              : thenChainEagerly(newHead, functionChain, onRejected, index + 1)),
      error => {
        if (!contextName) contextName = new Error("thenable resolution");
        // TODO(iridian, 2021-03): Same inconsistency as in comment above.
        return onThenChainError(error);
      });
  function onThenChainError (error) {
    if (!contextName.origin) {
      contextName.origin = contextName.message;
      const functionName = (functionChain[index] || "").name;
      contextName.message = `During ${
            `${functionName ? `${functionName} (as ` : ""
          }thenChainEagerly ${
            index === -1 ? "initial value" : `step #${index}`}`
          } ${contextName.origin}${functionName ? ")" : ""}`;
    }
    const wrappedError = wrapError(error, errorDetailLevel, contextName,
        "\n\tvalue:", ...dumpObject(head, { nest: 0 }),
        "\n\tinitialValue:", ...dumpObject(initialValue));
    if (!onRejected) throw wrappedError;
    return onRejected(wrappedError, index, head, functionChain, onRejected);
  }
}

const _redirectionPrototype = { target: null, params: null };

function thisChainEagerly (
    this_, // : any,
    initialParams, // : any,
    functions, // : any | Function[],
    onRejected, // : ?Function,
    startIndex, // : number
    errorDetailLevel = 2, // : number
) {
  let index = startIndex || 0, params = initialParams;
  let paramsArray, contextName;
  for (;;) {
    if ((typeof params === "object") && (params != null)) {
      if (Array.isArray(params)) {
        let i = 0;
        paramsArray = params;
        for (; i !== params.length; ++i) {
          if ((params[i] != null) && (typeof params[i].then === "function")) {
            params = Promise.all(params);
            break;
          }
        }
        if (params.length === undefined) break; // promise
      } else if (Object.getPrototypeOf(params) === _redirectionPrototype) {
        const target = params.target;
        params = params.params;
        index = functions[target];
        if (typeof index === "function") index = Number(target);
        else if (typeof index !== "number") {
          if (!target) {
            return params; // return directive
          }
          index = functions.findIndex(f => (f.name === target));
          if (index === -1) {
            throw new Error(
                `thisChainEagerly can't find redirection function with name '${target}'`);
          }
          functions[target] = index;
        }
        continue;
      } else if (typeof params.then === "function") {
        break;
      } // else any other object
    }
    const func = functions[index];
    if (!func) {
      if (++index < functions.length) continue;
      return params;
    }
    try {
      params = paramsArray
          ? func.apply(this_, paramsArray)
          : func.call(this_, params);
      ++index;
    } catch (error) {
      contextName = new Error("callback call");
      params = onThisChainError(error);
      index = functions.length;
    }
    paramsArray = null;
  }
  --index;
  contextName = (errorDetailLevel != null) && new Error("thenable resolution");
  return params.then(
      newParams =>
          thisChainEagerly(this_, newParams, functions, onRejected, index + 1),
      error => {
        if (!contextName) contextName = new Error("thenable resolution");
        const retry = onThisChainError(error);
        return thisChainEagerly(this_, retry, functions, onRejected, functions.length);
      });

  function onThisChainError (error) {
    if (!contextName.origin) {
      contextName.origin = contextName.message;
      const functionName = (functions[index] || "").name;
      contextName.message = `During ${
            `${functionName ? `${functionName} (as ` : ""
          }thisChainEagerly ${
            index === -1 ? "initial params" : `step #${index}`}`
          } ${contextName.origin}${functionName ? ")" : ""}`;
    }
    const wrappedError = wrapError(error, errorDetailLevel, contextName,
        "\n\tthis:", ...dumpObject(this_, { nest: 0 }),
        "\n\tparams:", ...dumpObject(params),
        "\n\tinitialParams:", ...dumpObject(initialParams),
    );
    if (!onRejected) throw wrappedError;
    return onRejected.call(
        this_, wrappedError, index, paramsArray || params, functions, onRejected);
  }
}

function thisChainRedirect (targetNameOrIndex, params) {
  const ret = Object.create(_redirectionPrototype);
  ret.target = targetNameOrIndex;
  ret.params = params;
  return ret;
}

function thisChainReturn (returnValue) {
  const ret = Object.create(_redirectionPrototype);
  ret.params = returnValue;
  return ret;
}

function wrapOutputError (callback, header, onError) {
  let actualOnError = onError, actualHeader = header;
  if (typeof header === "function") {
    actualOnError = header;
    actualHeader = header.name;
  }
  return (...forwardedArgs) => thenChainEagerly(
      null,
      () => callback(...forwardedArgs),
      error => {
        let rethrow, ret;
        try {
          if (!actualOnError) rethrow = error;
          else ret = actualOnError(error);
        } catch (innerError) {
          rethrow = innerError;
        }
        outputError(rethrow || error,
            actualHeader || `Exception ${rethrow ? "rethrown" : "caught"} by wrapOutputError`);
        if (rethrow) throw rethrow;
        return ret;
      });
}
