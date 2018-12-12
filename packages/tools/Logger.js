// @flow

import SimpleData from "~/tools/SimpleData";
import wrapError, { outputError } from "~/tools/wrapError";

export default class Logger extends SimpleData {
  constructor (options: ?any) {
    super(options);
    if (!this.log) this.log = console.log.bind(console);
    if (!this.warn) this.warn = console.warn.bind(console);
    if (!this.error) this.error = console.error.bind(console);
    if (!this.info) this.info = console.info.bind(console);
  }
  log: Function;
  warn: Function;
  error: Function;
  info: Function;
}

let counter = 0;

export class LogEventGenerator {
  _logger: Logger | Object;
  _name: string;
  _verbosity: ?number;

  constructor ({ name = `unnamed#${++counter}`, logger, verbosity }: {
    name?: string, logger?: Logger, verbosity?: number
  } = {}) {
    this._logger = logger || console;
    this._verbosity = verbosity || 0;
    this._name = name;
  }

  fork (overrides: any) {
    const ret = Object.create(this);
    if (overrides) Object.assign(ret, overrides);
    return ret;
  }

  getLogger (): Logger | Object { return this._logger; }
  getName (): string { return this._name; }
  setName (name: any) { this._name = name; }

  getVerbosity () { return this._verbosity; }
  setVerbosity (value: number) { this._verbosity = value; }

  debugId (): string { return `${this.constructor.name}(${this.getName()})`; }

  info (...rest: any[]) { return this._logger.info(...rest); }
  log (...rest: any[]) { return this._logger.log(...rest); }
  warn (...rest: any[]) { return this._logger.warn(...rest); }
  error (...rest: any[]) { return this._logger.error(...rest); }

  infoEvent (minVerbosity: any, maybeFunction: any, ...messagePieces: any[]) {
    if ((typeof minVerbosity === "number") && (minVerbosity > this._verbosity)) return this;
    return this._outputMessageEvent(this._logger.info.bind(this._logger),
        minVerbosity, maybeFunction, ...messagePieces);
  }
  logEvent (minVerbosity: any, maybeFunction: any, ...messagePieces: any[]) {
    if ((typeof minVerbosity === "number") && (minVerbosity > this._verbosity)) return this;
    return this._outputMessageEvent(this._logger.log.bind(this._logger),
        minVerbosity, maybeFunction, ...messagePieces);
  }
  warnEvent (minVerbosity: any, maybeFunction: any, ...messagePieces: any[]) {
    if ((typeof minVerbosity === "number") && (minVerbosity > this._verbosity)) return this;
    return this._outputMessageEvent(this._logger.warn.bind(this._logger),
        minVerbosity, maybeFunction, ...messagePieces);
  }
  errorEvent (minVerbosity: any, maybeFunction: any, ...messagePieces: any[]) {
    if ((typeof minVerbosity === "number") && (minVerbosity > this._verbosity)) return this;
    return this._outputMessageEvent(this._logger.error.bind(this._logger),
        minVerbosity, maybeFunction, ...messagePieces);
  }
  _outputMessageEvent (operation: Function, minVerbosity: any, maybeFunction: any,
      ...messagePieces: any[]) {
    let pieces = (typeof minVerbosity === "number") && !messagePieces.length
            && (typeof maybeFunction === "function") && maybeFunction();
    if (!Array.isArray(pieces)) {
      pieces = pieces ? [pieces]
          : typeof minVerbosity !== "number" ? [minVerbosity, maybeFunction, ...messagePieces]
          : typeof maybeFunction !== "function" ? [maybeFunction, ...messagePieces]
          : messagePieces;
    }
    return operation(`${this.debugId()}:`, ...pieces);
  }

  wrapErrorEvent (error: Error, functionName: Error | string, ...contexts: any[]) {
    // Don't rewrap the error if it's already wrapped with the same functionName in the same context
    const actualFunctionName = functionName instanceof Error ? functionName.message : functionName;
    if (error.hasOwnProperty("functionName")
        && (error.functionName === actualFunctionName)
        && (error.contextObject === this)) {
      return error;
    }
    if (typeof error === "object") error.frameListClipDepth = 5;
    const wrapperError = (functionName instanceof Error) ? functionName : new Error("");
    wrapperError.message =
        `During ${this.debugId()}\n .${actualFunctionName}${contexts.length ? ", with:" : ""}`;
    const ret = wrapError(error, wrapperError, ...contexts);
    ret.functionName = actualFunctionName;
    ret.contextObject = this;
    return ret;
  }

  outputErrorEvent (error: Error, ...rest) {
    return outputError(error, ...rest);
  }
}

export function createForwardLogger ({ name, enableLog = true, enableWarn = true,
    enableError = true, enableInfo = true, target = console }: Object): Logger {
  const getName = () => (typeof name === "string" ? name : name.name);
  return new Logger(name
      ? {
        log (...rest: any[]) { if (enableLog) target.log(`${getName()}:`, ...rest); },
        warn (...rest: any[]) { if (enableWarn) target.warn(`${getName()}:`, ...rest); },
        error (...rest: any[]) { if (enableError) target.error(`${getName()}:`, ...rest); },
        info (...rest: any[]) { if (enableInfo) target.info(`${getName()}:`, ...rest); },
      } : {
        log (...rest: any[]) { if (enableLog) target.log(...rest); },
        warn (...rest: any[]) { if (enableWarn) target.warn(...rest); },
        error (...rest: any[]) { if (enableError) target.error(...rest); },
        info (...rest: any[]) { if (enableInfo) target.info(...rest); },
      }
  );
}
