// import StackTrace from "stacktrace-js";
import beaumpify from "~/tools/beaumpify";
import { invariantifyObject } from "~/tools/invariantify";
import isSymbol from "~/tools/isSymbol";
import inBrowser from "~/tools/inBrowser";

if (typeof window !== "undefined") window.beaumpify = beaumpify;

export function dumpObject (value) {
  const ret = [];
  if ((value != null) && (typeof value.debugId === "function")) ret.push(`'${value.debugId()}'`);
  ret.push(debugObject(value));
  return ret;
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
  if ((typeof error !== "object") || !error || (typeof error.message !== "string")) {
    console.error("INVARIANT VIOLATION during wrapError:",
        "first argument must be an object with .message property!", "Instead got", error);
    invariantifyObject(error, "wrapError.error", { instanceof: Error });
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
  error.errorContexts = (error.errorContexts || []).concat([contextError]);

  // FIXME (thiago) this breaks abstractions
  // contextError.sourceStackFrames = errorIn && errorIn.sourceStackFrames;
  // contextError.customErrorHandler = errorIn && errorIn.customErrorHandler;
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
    console.log("outerError has no .tidyFrameList:", outerError,
      "\n\ttoString:", outerError.toString(),
    );
    return ["<<< outer error tidyFrameList missing>>>"];
  }
  if (!innerError.tidyFrameList) {
    if (!innerError.stack) {
      console.log("innerError has no .stack:", innerError,
        "\n\ttoString:", innerError.toString(),
      );
      return ["<<< inner error stack empty>>>"];
    }
    const typeHeader = innerError.stack.match(/[^:]*: /);
    innerError.tidyFrameList = innerError.stack
        .slice(((typeHeader && typeHeader[0].length) || 0) + innerError.message.length)
        .split("\n")
        .slice(1);
  }
  const inner = innerError.tidyFrameList;
  const outer = outerError.tidyFrameList;
  let skipInner = 0;
  let skipOuter = 0;
  let matches;
  for (; skipOuter !== outer.length; ++skipOuter) {
    // Find first matching line
    while ((skipInner !== inner.length) && (inner[skipInner] !== outer[skipOuter])) ++skipInner;
    // Check that remaining lines match
    matches = 0;
    for (; ((skipInner + matches) !== inner.length) && ((skipOuter + matches) !== outer.length);
        ++matches) {
      if (inner[skipInner + matches] !== outer[skipOuter + matches]) {
        matches = undefined;
        break;
      }
    }
    if (matches !== undefined) break;
  }
  if (matches === undefined) inner.push("<<< possibly missing frames >>>");
  else {
    inner.splice(skipInner);
    if (skipOuter) outer.splice(0, skipOuter);
  }
  return inner;
}

export function outputError (error, header = "Exception caught", logger = errorLogger) {
  logger.error(`  ${header} (with ${(error.errorContexts || []).length} contexts):\n\n`,
      error.originalMessage || error.message, `\n `);
  if (error.customErrorHandler) {
    error.customErrorHandler(logger);
  }
  if (error.originalError) {
    logger.log(error.originalError.tidyFrameList.join("\n"));
  }
  for (const context of (error.errorContexts || [])) {
    logger.warn(...context.contextDescriptions.map(beaumpifyObject));
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

export function debugObjectNest (head, nest = 1, alwaysStringify = false) {
  try {
    if (head === null) return "<null>";
    if (head === undefined) return "<undefined>";
    if (!head || (!alwaysStringify && inBrowser())) return head;
    if (typeof head === "function") {
      if (head.name) return `<function name="${head.name}">`;
      const lineCount = (head.toString().match(/\n/g) || []).length + 1;
      return `<lambda body.lines=${lineCount}>`;
    }
    if (head instanceof Function) return `<Function name="${head.name}">`;
    if (isSymbol(head)) return `<${head.toString()}>`;
    if (typeof head !== "object") return head;
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
    return ((Array.isArray(head)
            && `[${head.map(entry => debugObjectNest(entry, nest, alwaysStringify)).join(", ")}]`)
        || (isIterable(head) && debugObjectNest(head.toJS(), nest, alwaysStringify))
        || (head[Symbol.iterator] && debugObjectNest([...head], nest, alwaysStringify))
        || `{ ${Object.keys(head)
              .map(key => `${isSymbol(key) ? key.toString() : key}: ${
                  debugObjectNest(head[key], nest - 1, alwaysStringify)}`)
              .join(", ")
            } }`);
  } catch (error) {
    console.error("Suppressed an error in debugObjectNest:", error,
        "\n\treturning head:", head);
  }
  return head;
}

function isIterable (candidate) {
  return (typeof candidate === "object") && (typeof candidate.toJS === "function");
}

function beaumpifyObject (value) {
  if (inBrowser() || !value || (typeof value !== "object")) return value;
  return beaumpify(debugObject(value));
}

let errorLogger = typeof window !== "undefined" || !process
    ? console
    : {
      log (...params) { console.log(...params.map(beaumpifyObject)); },
      warn (...params) { console.warn(...params.map(beaumpifyObject)); },
      error (...params) { console.error(...params.map(beaumpifyObject)); },
    };

let stackFrameCounter = 0;

if (typeof process !== "undefined") {
  process.on("unhandledRejection", unhandledRejection);
}

if ((window || {}).addEventListener) {
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
