// import StackTrace from "stacktrace-js";

const dumpify = require("~/tools/dumpify").default;
const inBrowser = require("~/gateway-api/inBrowser").default;
const isSymbol = require("~/tools/isSymbol").default;

if (typeof window !== "undefined") window.beaumpify = dumpify;

// TODO(iridian, 2019-02): Sigh... these debug output functions are
// getting out of hand. They should be streamlined.

// returns an spreadable array with different views to the value.
export function dumpObject (value) {
  const ret = [];
  if ((value != null) && (typeof value.debugId === "function")) ret.push(`'${value.debugId()}'`);
  ret.push(debugObject(value));
  return ret;
}

// This is maybe used in node context. I don't remember what special
// purpose it has
function dumpifyObject (value) {
  if (inBrowser() || !value || (typeof value !== "object")) return value;
  return dumpify(debugObject(value));
}

/**
 *  Wraps given error in a new error, with given contextDescriptions added.
 *  The contextDescription can be anything that can be given to console.log/error, but as guideline:
 *  throw wrapError(error, `During MyClass(${instanceId}).myFunction(`, param1, `}), with:`,
 *      "\n\tcontextdata1:", contextdata1,
 *      "\n\tcontextdata2:", contextdata2);
 * ${beaumpify(someLargerObject)}`
 *
 * @export
 * @param {any} error
 * @param {any} contextDescription
 * @returns
 */
export default function wrapError (errorIn: Error, ...contextDescriptions) {
  const error = _tryCooperativeError(errorIn) || new Error(errorIn);
  if (!error.stack) error.stack = (new Error("dummy").stack);
  if ((typeof error !== "object") || !error || (typeof error.message !== "string")) {
    console.error("INVARIANT VIOLATION during wrapError:",
        "first argument must be an object with .message property!", "Instead got", error);
    throw new Error("wrapError.error must be an Error object");
  }
  const originalMessage = error.originalMessage || error.message;
  let contextError = contextDescriptions[0];
  if (!(contextError instanceof Error)) {
    contextError = new Error("", error.fileName, error.lineNumber);
  } else contextDescriptions[0] = contextDescriptions[0].message;
  if (!contextError.tidyFrameList) {
    contextError.tidyFrameList = contextError.stack.split("\n")
        .slice(!contextError.message ? 3 : 2);
  }
  const outermostError = error.errorContexts
      ? error.errorContexts[error.errorContexts.length - 1]
      : error;
  const clippedFrameList = _clipFrameListToCurrentContext(outermostError, contextError);
  const myTraceAndContext = `${clippedFrameList.join("\n")}
${contextDescriptions.map(debugObjectHard).join(" ")}`;
  const allTraceAndContext = `${error.allTraceAndContext || ""}
${myTraceAndContext}`;
  contextError.message = `${originalMessage}\n${allTraceAndContext}`;
  contextError.clippedFrameList = clippedFrameList;
  contextError.allTraceAndContext = allTraceAndContext;
  contextError.originalError = error.originalError || error;
  contextError.originalMessage = originalMessage;
  contextError.contextDescriptions = contextDescriptions;
  error.originalError = error.originalError || error;
  error.errorContexts = (error.errorContexts || []).concat([contextError]);
  return error;
}

const _cooperativeErrorTypes = {
  Error: true,
  EvalError: true,
  InternalError: true,
  RangeError: true,
  ReferenceError: true,
  SyntaxError: true,
  TypeError: true,
  URIError: true,
};

function _tryCooperativeError (error: any) {
  if (error == null) return undefined;
  return ((error instanceof Error) || _cooperativeErrorTypes[(error.constructor || {}).name])
      && error;
}

export function unwrapError (error: Error) {
  return (error && error.originalError) || error;
}

export function messageFromError (error: any) {
  if (typeof error !== "object" || !error) return String(error);
  if (!(error instanceof Error)) {
    return `<unrecognized Error object ${
        (error.constructor && error.constructor.name) || "with no type"}>`;
  }
  if (!error.customErrorHandler) return error.message;
  let message = error.originalMessage || error.message;
  const catenator = { error (...args) {
    message += `\n${args.map(entry => String(entry)).join(" ")}`;
  } };
  error.customErrorHandler(catenator);
  return message;
}

function _clipFrameListToCurrentContext (innerError, outerError) {
  if (!outerError.tidyFrameList) {
    console.error("outerError has no .tidyFrameList:", outerError,
      "\n\ttoString:", outerError.toString(),
    );
    return ["<<< outer error tidyFrameList missing>>>"];
  }
  if (!innerError.tidyFrameList) {
    if (!innerError.stack) {
      console.error("innerError has no .stack:", innerError,
        "\n\ttoString:", innerError.toString(),
      );
      return (innerError.tidyFrameList = ["<<< inner error stack empty>>>"]);
    }
    const typeHeader = innerError.stack.match(/[^:]*: /);
    innerError.tidyFrameList = innerError.stack
        .slice(((typeHeader && typeHeader[0].length) || 0) + innerError.message.length)
        .split("\n")
        .slice(1);
  }
  const inner = innerError.tidyFrameList;
  const outer = outerError.tidyFrameList;
  // console.log("clipping inner:", inner);
  // console.log("versus context:", outer);
  let skipInner = 0;
  let skipOuter = 0;
  let matches = 0;
  if (inner.length && (inner[inner.length - 1].slice(0, 3) !== "<<<")) {
    for (; !matches && (skipOuter !== outer.length); ++skipOuter) {
      // Find first matching line
      for (skipInner = 0; (skipInner !== inner.length) && (inner[skipInner] !== outer[skipOuter]);
          ++skipInner);
      // Check that remaining lines match
      for (; ((skipInner + matches) !== inner.length) && ((skipOuter + matches) !== outer.length);
          ++matches) {
        if (inner[skipInner + matches] !== outer[skipOuter + matches]) {
          matches = 0;
          break;
        }
      }
    }
  }
  // let innerSplice, outerSplice;
  if (!matches || (skipOuter > skipInner + 2)) {
    inner.push("<<< disjoint inner and context error traces >>>");
  } else {
    inner.splice(skipInner || 1); // Always keep at least one line in the inner log
    // If skipOuter is larger than skipInner then this is likely a
    // disjoint trace with accidentally identical outermost trace.
    // Keep the whole context trace
    if (skipOuter) outer.splice(0, skipOuter);
  }
  /*
  console.log("matched", matches, "lines");
  console.log("spliced inner from line", skipInner, "onwards:", innerSplice);
  console.log("spliced outer up to line", skipInner, ":", outerSplice);
  */
  return inner;
}

export function outputError (error, header = "Exception caught", logger = errorLogger) {
  (logger.exception || logger.error).call(logger,
      `  ${header} (with ${(error.errorContexts || []).length} contexts):\n\n`,
      error.originalMessage || error.message, `\n `);
  if (error.customErrorHandler) {
    error.customErrorHandler(logger);
  }
  if (error.originalError) {
    logger.log(error.originalError.tidyFrameList.join("\n"));
  } else {
    logger.log(error.stack.split("\n").slice(1).join("\n"));
  }
  for (const context of (error.errorContexts || [])) {
    logger.warn(...context.contextDescriptions.map(dumpifyObject));
    logger.log((context.tidyFrameList).join("\n"));
  }
}

export function outputCollapsedError (error, header = "Exception caught", logger = errorLogger) {
  const collapsedContexts = [];
  const collapsingLogger = {
    log: (...args) => collapsedContexts[collapsedContexts.length - 1].traces.push(
        ...args[0].split("\n")),
    warn: (...args) => collapsedContexts.push({ context: args, traces: [] }),
    error: (...args) => collapsedContexts.push({ context: args, traces: [] }),
  };
  const ret = outputError(error, header, collapsingLogger);
  delete collapsedContexts[0].context;
  logger.error(`  ${header} (with ${(error.errorContexts || []).length} collapsed contexts):\n`,
      error.originalMessage || error.message, "\n", { collapsedContexts });
  return ret;
}

// async function displayErrorStackFramesWithSourceMaps (error, counter, logger) {
//   const stackFrameListPromises = (error.errorContexts || []).map(
//       wrappedError => StackTrace.fromError(wrappedError).then(
//           onSuccessValue => {
//             // console.log("Resolved stack frame:", onSuccessValue);
//             return onSuccessValue;
//           },
//           onFailureValue => {
//             // console.log("Failed to resolve stack frame:", onFailureValue);
//             throw onFailureValue;
//           }));
//   stackFrameListPromises.push(StackTrace.fromError(error));
//   // console.log("Awaiting", stackFrameListPromises.length, "stack frames:",
//          stackFrameListPromises);
//   const stackFrameLists = await Promise.all(stackFrameListPromises);
//   logger.error(`  Sourcemapped exception stack trace #${counter} (with ${
//       error.errorContexts.length} contexts):\n\n  `,
//       error.originalMessage || error.message, `\n `);
//   displayErrorStackFrameLists(stackFrameLists, error.contextDescriptions, logger);
// }

export function debugObject (head) { return debugObjectNest(head); }
export function debugObjectHard (head) { return debugObjectNest(head, 1, true); }
export function debugObjectType (head) { return debugObjectNest(head, false, false); }

export function debugObjectNest (head, nest = 1, alwaysStringify = false, cache_: ?Object) {
  try {
    if (head === null) return "<null>";
    if (head === undefined) return "<undefined>";
    if (!alwaysStringify && inBrowser()) return head;
    if (typeof head === "function") {
      if (head.name) return `<function ${head.name}>`;
      const lineCount = (head.toString().match(/\n/g) || []).length + 1;
      return `<lambda body.lines=${lineCount}>`;
    }
    if (head instanceof Function) return `<Function name="${head.name}">`;
    if (isSymbol(head)) return `<${head.toString()}>`;
    if (typeof head === "string") return (nest !== false) ? head : `<string length=${head.length}>`;
    if (typeof head !== "object") return (nest !== false) ? head : `<${typeof head}>`;
    if (!nest) {
      if (Array.isArray(head)) return `<Array length=${head.length} >`;
      if (isIterable(head)) return `<immutable.Iterable size=${head.size}>`;
      if (head instanceof Map) return `<Map size=${head.size}>`;
      if (head instanceof WeakMap) return `<WeakMap size=${head.size}>`;
      if (head instanceof Set) return `<Set size=${head.size}>`;
      if (head[Symbol.iterator]) return `<Iterable ${head.constructor.name}>`;
    }
    if (head.toString && (typeof nest === "number")
        && (head.toString !== Object.prototype.toString)
        && (head.toString !== Array.prototype.toString)) {
      return head.toString(nest);
    }
    if (!nest) {
      return `<${(head.constructor && head.constructor.name) || "no-constructor"} keys.length=${
          Object.keys(head).length}>`;
    }
    const cache = cache_ || new Map();
    const circularIndex = cache.get(head);
    if (circularIndex) return `<Circular #${circularIndex}: ${debugObjectNest(head, 0)}>`;
    cache.set(head, (cache.objectIndex = (cache.objectIndex || 0) + 1));
    return ((Array.isArray(head) && `[${
            head.map(entry => debugObjectNest(entry, nest, alwaysStringify, cache)).join(", ")}]`)
        || (isIterable(head) && debugObjectNest(head.toJS(), nest, alwaysStringify, cache))
        || (head[Symbol.iterator] && debugObjectNest([...head], nest, alwaysStringify, cache))
        || `{ ${Object.keys(head)
              .map(key => `${isSymbol(key) ? key.toString() : key}: ${
                  debugObjectNest(head[key], nest - 1, alwaysStringify, cache)}`)
              .join(", ")
            } }`);
  } catch (error) {
    console.error("Suppressed an error in debugObjectNest:",
        "\n\terror.message:", error.message,
        "\n\terror.stack:", error.stack,
        "\n\treturning head:", head);
  }
  return head;
}

function isIterable (candidate) {
  return (typeof candidate === "object") && (typeof candidate.toJS === "function");
}

let errorLogger = (typeof window !== "undefined") || !process
    ? console
    : {
      log (...params) { console.log(...params.map(dumpifyObject)); },
      warn (...params) { console.warn(...params.map(dumpifyObject)); },
      error (...params) { console.error(...params.map(dumpifyObject)); },
    };

export function setGlobalLogger (logger) {
  errorLogger = logger;
}

let stackFrameCounter = 0;

if (typeof process !== "undefined") {
  process.on("unhandledRejection", unhandledRejection);
}

if ((((typeof window !== "undefined") && window) || {}).addEventListener) {
  window.addEventListener("error", event => {
    event.preventDefault();
    unhandledError(event.error);
  });
  window.addEventListener("unhandledrejection", event => {
    event.preventDefault();
    unhandledRejection(event.reason, event.promise);
  });
}

function unhandledError (error) {
  stackFrameCounter += 1;
  const header = `UNHANDLED ERROR #${stackFrameCounter}`;
  if (error instanceof Error) {
    outputError(error, header, errorLogger);
  } else {
    errorLogger.error(header);
    errorLogger.error(`  Irregular error info:`,
        (error && (typeof error === "object") && (error.stack || error.message)) || error);
  }
}

function unhandledRejection (reason, promise) {
  stackFrameCounter += 1;
  const header =
      `UNHANDLED PROMISE REJECTION #${stackFrameCounter
          }: a Promise somewhere is missing then/catch and `
      + `an exception occurred.\n\tThis happens when an async function throws and `
      + `the call site doesn't handle the Promise returned by the function (neither with await nor `
      + `by explicit .then/.catch).
The actual error:`;
  if (reason instanceof Error) {
    outputError(reason, header, errorLogger);
  } else {
    errorLogger.error(header);
    errorLogger.error(`  Error info:`, promise,
        (reason && typeof reason === "object" && (reason.stack || reason.message)) || reason);
  }
}

Error.stackTraceLimit = 100000;
