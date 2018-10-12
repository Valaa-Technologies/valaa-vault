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
  const clippedFrameList = _clipFrameListToCurrentContext(error, error.frameListClipDepth || 4);
  const originalMessage = error.originalMessage || error.message;
  let ret = contextDescriptions[0];
  if (!(ret instanceof Error)) ret = new Error("", error.fileName, error.lineNumber);
  else contextDescriptions[0] = contextDescriptions[0].message;
  const myTraceAndContext = `${clippedFrameList.join("\n")}
${contextDescriptions.map(debugObjectHard).join(" ")}`;
  const allTraceAndContext = `${error.allTraceAndContext || ""}
${myTraceAndContext}`;
  ret.message = `${originalMessage}\n${allTraceAndContext}`;
  ret.clippedFrameList = clippedFrameList;
  ret.allTraceAndContext = allTraceAndContext;
  ret.originalError = error.originalError || error;
  ret.originalMessage = originalMessage;
  ret.contextDescriptions = contextDescriptions;
  ret.errorContexts = (error.errorContexts || []).concat([ret]);

  // FIXME (thiago) this breaks abstractions
  ret.sourceStackFrames = errorIn.sourceStackFrames;
  ret.customErrorHandler = errorIn.customErrorHandler;
  return ret;
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

function _clipFrameListToCurrentContext (innerError, dummySliceLineCount) {
  if (!innerError.stack) {
    console.log("innerError has no .stack:", innerError,
      "\n\ttoString:", innerError.toString(),
      "\n\tfilename:", innerError.toString(),
      "\n\ttoString:", innerError.toString(),
    );
    return ["<<< inner error stack empty>>>"];
  }
  const typeHeader = innerError.stack.match(/[^:]*: /);
  const innerTraceList = innerError.stack
      .slice(((typeHeader && typeHeader[0].length) || 0) + innerError.message.length)
      .split("\n")
      .slice(1);
  if (typeof dummySliceLineCount === "undefined") return innerTraceList;
  const outerStack = (new Error("dummy")).stack;
  if (!outerStack) return innerTraceList;
  const outerTraceList = outerStack.split("\n").slice(dummySliceLineCount);
  for (let i = Math.max(0, innerTraceList.length - outerTraceList.length)
      ; i < innerTraceList.length; i += 1) {
    let j = 0;
    while (i + j < innerTraceList.length && j < outerTraceList.length
        && innerTraceList[i + j] === outerTraceList[j]) ++j;
    if (i + j === innerTraceList.length) return innerTraceList.slice(0, i);
  }
  return innerTraceList.concat(["<<< possibly missing frames >>>"]);
}

export function outputError (error, header = "Exception caught", logger = errorLogger) {
  logger.error(`  ${header} (with ${(error.errorContexts || []).length} contexts):\n\n`,
      error.originalMessage || error.message, `\n `);
  if (error.customErrorHandler) {
    error.customErrorHandler(logger);
  }
  for (const context of (error.errorContexts || [])) {
    logger.log((context.clippedFrameList).join("\n"));
    logger.error(...context.contextDescriptions.map(beaumpifyObject));
  }
  logger.log(_clipFrameListToCurrentContext(error).slice(1).join("\n"));
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

export function debugObjectNest (head, nest = 1, alwaysStringify = false) {
  try {
    if (!head || (!alwaysStringify && inBrowser())) return head;
    if (typeof head === "function") {
      if (head.name) return `<function name="${head.name}">`;
      return `<lambda body.length=${head.toString().length}>`;
    }
    if (head instanceof Function) return `<Function name="${head.name}">`;
    if (isSymbol(head)) return `<${head.toString()}>`;
    if (typeof head !== "object") return head;
    if (!nest) {
      if (Array.isArray(head)) return `<Array length=${head.length} >`;
      if (isIterable(head)) return `<Iterable size=${head.size}>`;
    }
    if (head.toString
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
