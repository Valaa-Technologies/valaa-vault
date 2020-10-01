// import StackTrace from "stacktrace-js";

const dumpify = require("./dumpify").default;
const isSymbol = require("./isSymbol").default;
const inBrowser = require("../gateway-api/inBrowser").default;

if (typeof window !== "undefined") window.beaumpify = dumpify;

module.exports = {
  debugObject,
  debugObjectHard,
  debugObjectType,
  debugObjectNest,
  dumpObject,
  messageFromError,
  outputCollapsedError,
  outputError,
  setGlobalLogger,
  unwrapError,
  wrapError,
};

// TODO(iridian, 2019-02): Sigh... these debug output functions are
// getting out of hand. They should be streamlined.

// returns an spreadable array with different views to the value.
function dumpObject (value, { nest, alwaysStringify, indent, expandFields } = {}) {
  const ret = [];
  if ((value != null) && (typeof value.debugId === "function")) ret.push(`'${value.debugId()}'`);
  ret.push(debugObjectNest(value, nest, alwaysStringify, indent, expandFields));
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
function wrapError (errorIn, contextName, ...contextDescriptions) {
  const error = _tryCooperativeError(errorIn) || new Error(errorIn);
  if (!error.stack) error.stack = (new Error("dummy").stack);
  if ((typeof error !== "object") || !error || (typeof error.message !== "string")) {
    console.error("INVARIANT VIOLATION during wrapError:",
        "first argument must be an object with .message property!", "Instead got", error);
    throw new Error("wrapError.error must be an Error object");
  }
  const originalMessage = error.originalMessage || error.message;
  const contextError = new Error("", error.fileName, error.lineNumber);
  if (!(contextName instanceof Error)) {
    contextError.name = contextName;
    contextError.tidyFrameList = contextError.stack.split("\n").slice(3);
  } else {
    contextError.name = contextName.message;
    contextError.tidyFrameList = contextName.stack.split("\n").slice(2);
    contextError.logger = contextName.logger;
    contextError.verbosities = contextName.verbosities;
  }
  const outermostError = error.errorContexts
      ? error.errorContexts[error.errorContexts.length - 1]
      : error;
  const clippedFrameList = _clipFrameListToCurrentContext(outermostError, contextError);
  // const myTraceAndContext = `${clippedFrameList.join("\n")}
  // ${contextDescriptions.map(debugObjectHard).join(" ")}`;
  // const allTraceAndContext = `${error.allTraceAndContext || ""}
  // ${myTraceAndContext}`;
  contextError.message = errorIn.message; // `${originalMessage}\n${allTraceAndContext}`;
  contextError.clippedFrameList = clippedFrameList;
  // contextError.allTraceAndContext = allTraceAndContext;
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

function _tryCooperativeError (error) {
  if (error == null) return undefined;
  return ((error instanceof Error) || _cooperativeErrorTypes[(error.constructor || {}).name])
      && error;
}

function unwrapError (error) {
  return (error && error.originalError) || error;
}

function messageFromError (error) {
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

function outputError (error, header = "Exception caught", logger = _globalLogger,
    contextVerbosity = 1) {
  (logger.errorEvent || logger.error).call(logger,
      `  ${header} (with ${(error.errorContexts || []).length} contexts):\n\n`,
      error.originalMessage || error.message, `\n `);
  if (error.customErrorHandler) {
    error.customErrorHandler(logger);
  }
  let traces = error.originalError
      ? error.originalError.tidyFrameList || []
      : error.stack.split("\n").slice(1);
  for (const context of (error.errorContexts || [])) {
    const contextLogger = context.logger || logger;
    const verbosities = context.verbosities || [0];
    if (verbosities[1] === undefined) verbosities.unshift(contextVerbosity);
    const excess = verbosities[0] - verbosities[1];
    if (excess >= 0) {
      logger.debug(traces.join("\n"));
      traces = [];
      const warn = (contextLogger.warnEvent || contextLogger.warn).bind(contextLogger);
      warn(`[${verbosities.join(">=")}] error context by:\n  ${context.name}`,
          ...context.contextDescriptions.map(dumpifyObject));
    } else if (excess >= -1) {
      logger.debug(`\t[${verbosities.join("<")}]`, { traces }, `collapsed fabric traces`);
      traces = [];
      const lines = [];
      for (const entry of context.contextDescriptions) {
        if (!entry || entry[0] === "\n" || !lines.length) lines.push([]);
        lines[lines.length - 1].push(entry);
      }
      const info = (contextLogger.infoEvent || contextLogger.info).bind(contextLogger);
      info(`[${verbosities.join("<")}] collapsed error context by ${context.name}:`, lines);
    } else {
      traces.push(`  [${verbosities.join("<<")}] hidden error context by ${context.name}`);
    }
    traces.push(...(context.tidyFrameList || []));
  }
  logger.debug(traces.join("\n"));
}

function outputCollapsedError (error, header = "Exception caught", logger = _globalLogger) {
  const collapsedContexts = [];
  const collapser = {
    debug: (...args) => collapsedContexts[collapsedContexts.length - 1].traces
        .push(...args[0].split("\n")),
    // TODOO(iridian, 2020-04): Fix these: broken as outputError calls
    // contextLogger, not logger that was given to it
    info: (...args) => collapsedContexts.push({ context: args, traces: [] }),
    log: (...args) => collapsedContexts.push({ context: args, traces: [] }),
    warn: (...args) => collapsedContexts.push({ context: args, traces: [] }),
    error: (...args) => collapsedContexts.push({ context: args, traces: [] }),
  };
  const ret = outputError(error, header, collapser);
  delete collapsedContexts[0].context;
  (logger.errorEvent || logger.error).call(logger,
      `  ${header} (with ${(error.errorContexts || []).length} collapsed contexts):\n`,
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


function debugObject (head) {
  return debugObjectNest(head);
}

function debugObjectHard (head) {
  return debugObjectNest(head, 1, true);
}

function debugObjectType (head) {
  return debugObjectNest(head, false, false);
}

function debugObjectNest (head, nest = 1, alwaysStringify = false, indent, expandFields, cache_) {
  try {
    if (head === null) return "<null>";
    if (head === undefined) return "<undefined>";
    if (typeof head === "boolean") return `<${head}>`;
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
      if (head.then) return `<thenable ${(head.constructor || {}).name || ""}>`;
    }
    if (head.toString && (typeof nest === "number")
        && (head.toString !== Object.prototype.toString)
        && (head.toString !== Array.prototype.toString)) {
      return head.toString(nest);
    }
    if (nest) {
      const cache = cache_ || new Map();
      const circularIndex = cache.get(head);
      if (circularIndex) return `<Circular #${circularIndex}: ${debugObjectNest(head, 0)}>`;
      cache.set(head, (cache.objectIndex = (cache.objectIndex || 0) + 1));
      if (Array.isArray(head)) {
        return `[${
          head.map(entry => debugObjectNest(
                  entry, nest, alwaysStringify, indent ? indent + 1 : 0, expandFields, cache))
              .join(", ")}]`;
      }
      if (isIterable(head)) {
        return debugObjectNest(
            head.toJS(), nest, alwaysStringify, indent ? indent + 1 : 0, expandFields, cache);
      }
      if (head[Symbol.iterator]) {
        return debugObjectNest(
            [...head], nest, alwaysStringify, indent ? indent + 1 : 0, expandFields, cache);
      }
      if (expandFields || Object.getPrototypeOf(head) === Object.prototype) {
        return `{ ${Object.keys(head).map(key => {
          const desc = Object.getOwnPropertyDescriptor(head, key);
          return `${indent ? `\n${"  ".repeat(indent)}` : ""}${
            isSymbol(key) ? key.toString() : key}: ${
            debugObjectNest(desc.get || desc.value,
                (typeof nest !== "number") ? nest : nest - 1, alwaysStringify,
                indent ? indent + 1 : undefined, expandFields, cache)
          }`;
        }).join(", ")}${indent ? `\n${"  ".repeat(indent - 1)}` : " "}}`;
      }
    }
    return `<${(head.constructor || {}).name || "no-constructor"} keys.length=${
      Object.keys(head).length}>`;
  } catch (error) {
    console.error("Suppressed an error in debugObjectNest:",
        "\n\terror.message:", error.message,
        "\n\terror.stack:", error.stack);
  }
  return head;
}

function isIterable (candidate) {
  return (typeof candidate === "object") && (typeof candidate.toJS === "function");
}

let _globalLogger = (typeof window !== "undefined") || !process
    ? console
    : {
      debug (...params) { console.debug(...params.map(dumpifyObject)); },
      info (...params) { console.info(...params.map(dumpifyObject)); },
      log (...params) { console.log(...params.map(dumpifyObject)); },
      warn (...params) { console.warn(...params.map(dumpifyObject)); },
      error (...params) { console.error(...params.map(dumpifyObject)); },
    };

function setGlobalLogger (logger) {
  _globalLogger = logger;
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
    outputError(error, header, _globalLogger);
  } else {
    _globalLogger.error(header);
    _globalLogger.error(`  Irregular error info:`,
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
    outputError(reason, header, _globalLogger);
  } else {
    _globalLogger.error(header);
    _globalLogger.error(`  Error info:`, promise,
        (reason && typeof reason === "object" && (reason.stack || reason.message)) || reason);
  }
}

Error.stackTraceLimit = 100000;
