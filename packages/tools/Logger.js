// @flow

import SimpleData from "~/tools/SimpleData";
import { outputError, wrapError } from "~/tools/wrapError";

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
  setLogger (logger: Logger) { this._logger = logger; }
  getName (): string { return this._name; }
  getRawName (): string { return this._name; }
  setName (name: any) { this._name = name; }

  getVerbosity () { return this._verbosity; }
  setVerbosity (value: number) { this._verbosity = value; }

  debugId (opts): string {
    return `${this.constructor.name}(${!(opts || {}).raw ? this.getName() : this.getRawName()})`;
  }

  info (...rest: any[]) { return this._logger.info(...rest); }
  log (...rest: any[]) { return this._logger.log(...rest); }
  warn (...rest: any[]) { return this._logger.warn(...rest); }
  error (...rest: any[]) { return this._logger.error(...rest); }

  infoEvent (minVerbosity: any, maybeFunction: any, ...messagePieces: any[]) {
    if ((typeof minVerbosity === "number") && (minVerbosity > this._verbosity)) return this;
    return this._outputMessageEvent((this._logger.info || this._logger.log).bind(this._logger),
        true, minVerbosity, maybeFunction, ...messagePieces);
  }
  logEvent (minVerbosity: any, maybeFunction: any, ...messagePieces: any[]) {
    if ((typeof minVerbosity === "number") && (minVerbosity > this._verbosity)) return this;
    return this._outputMessageEvent(this._logger.log.bind(this._logger),
        true, minVerbosity, maybeFunction, ...messagePieces);
  }
  warnEvent (minVerbosity: any, maybeFunction: any, ...messagePieces: any[]) {
    if ((typeof minVerbosity === "number") && (minVerbosity > this._verbosity)) return this;
    return this._outputMessageEvent(this._logger.warn.bind(this._logger),
        true, minVerbosity, maybeFunction, ...messagePieces);
  }
  errorEvent (minVerbosity: any, maybeFunction: any, ...messagePieces: any[]) {
    if ((typeof minVerbosity === "number") && (minVerbosity > this._verbosity)) return this;
    return this._outputMessageEvent(this._logger.error.bind(this._logger),
        true, minVerbosity, maybeFunction, ...messagePieces);
  }
  clockEvent (minVerbosity: any, maybeFunction: any, ...messagePieces: any[]) {
    if ((typeof minVerbosity === "number") && (minVerbosity > this._verbosity)) return this;
    return this._outputMessageEvent(
        (this._logger.clock || this._logger.info || this._logger.log).bind(this._logger),
        false, minVerbosity, maybeFunction, ...messagePieces);
  }
  _outputMessageEvent (operation: Function, joinFirstPieceWithId: boolean,
      minVerbosity: any, maybeFunction: any, ...messagePieces: any[]) {
    let pieces = (typeof minVerbosity === "number") && !messagePieces.length
            && (typeof maybeFunction === "function") && maybeFunction();
    if (!Array.isArray(pieces)) {
      pieces = pieces ? [pieces]
          : typeof minVerbosity !== "number" ? [minVerbosity, maybeFunction, ...messagePieces]
          : typeof maybeFunction !== "function" ? [maybeFunction, ...messagePieces]
          : messagePieces;
    }
    // Prepend the debug id to the first entry if it is a string.
    // Valma logger gives only the first argument a specific coloring,
    // this way the actual first piece will get the coloring as well.
    return (typeof pieces[0] !== "string" || !joinFirstPieceWithId)
        ? operation(`${this.debugId({ raw: !joinFirstPieceWithId })}:`, ...pieces)
        : operation(`${this.debugId({ raw: !joinFirstPieceWithId })}: ${pieces[0]}`,
            ...pieces.slice(1));
  }

  wrapErrorEvent (error: Error, functionName: Error | string, ...contexts: any[]) {
    const actualFunctionName = functionName instanceof Error ? functionName.message : functionName;
    if (error.hasOwnProperty("functionName")
        && (error.functionName === actualFunctionName)
        && (error.contextObject === this)) {
      // Don't re-wrap the error if it's already wrapped with the same
      // functionName in the same context.
      return error;
    }
    const wrapperError = (functionName instanceof Error) ? functionName : new Error("");
    if (!wrapperError.tidyFrameList) {
      wrapperError.tidyFrameList = wrapperError.stack.split("\n")
          .slice((functionName instanceof Error) ? 2 : 3);
    }
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

  addChainClockers (minVerbosity: number, eventPrefix: string, thenChainCallbacks: Function[]) {
    if (!(this.getVerbosity() >= minVerbosity)) return thenChainCallbacks;
    return [].concat(...thenChainCallbacks.map((callback, index) => [
      ...(!callback.name ? [] : [head => {
        this.clockEvent(minVerbosity, `${eventPrefix}[${index}]`, callback.name);
        return head;
      }]),
      callback,
    ]),
    result => {
      this.clockEvent(minVerbosity, `${eventPrefix}.done`, "");
      return result;
    });
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
