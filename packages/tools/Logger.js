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
  _debugLevel: ?number;

  constructor ({ name = `unnamed#${++counter}`, logger, debugLevel }: {
    name?: string, logger?: Logger, debugLevel?: number
  } = {}) {
    this._logger = logger || console;
    this._debugLevel = debugLevel || 0;
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

  getDebugLevel () { return this._debugLevel; }
  setDebugLevel (value: number) { this._debugLevel = value; }

  debugId (): string { return `${this.constructor.name}(${this.getName()})`; }

  info (...rest: any[]) { return this._logger.info(...rest); }
  log (...rest: any[]) { return this._logger.log(...rest); }
  warn (...rest: any[]) { return this._logger.warn(...rest); }
  error (...rest: any[]) { return this._logger.error(...rest); }

  infoEvent (minLogLevel: any, ...messagePieces: any[]) {
    if ((typeof minLogLevel === "number") && (minLogLevel > this._debugLevel)) return this;
    return this._logger.info(`${this.debugId()}:`,
        ...((typeof minLogLevel !== "number") ? [minLogLevel] : []),
        ...messagePieces);
  }
  logEvent (minLogLevel: any, ...messagePieces: any[]) {
    if ((typeof minLogLevel === "number") && (minLogLevel > this._debugLevel)) return this;
    return this._logger.log(`${this.debugId()}:`,
        ...((typeof minLogLevel !== "number") ? [minLogLevel] : []),
        ...messagePieces);
  }
  warnEvent (minLogLevel: any, ...messagePieces: any[]) {
    if ((typeof minLogLevel === "number") && (minLogLevel > this._debugLevel)) return this;
    return this._logger.warn(`${this.debugId()}:`,
        ...((typeof minLogLevel !== "number") ? [minLogLevel] : []),
        ...messagePieces);
  }
  errorEvent (minLogLevel: any, ...messagePieces: any[]) {
    if ((typeof minLogLevel === "number") && (minLogLevel > this._debugLevel)) return this;
    return this._logger.error(`${this.debugId()}:`,
        ...((typeof minLogLevel !== "number") ? [minLogLevel] : []),
        ...messagePieces);
  }
  wrapErrorEvent (error: Error, functionName: string, ...contexts: any[]) {
    if (typeof error === "object") error.frameListClipDepth = 5;
    return wrapError(error, `During ${this.debugId()}\n .${functionName}${
        contexts.length ? ", with:" : ""}`,
        ...contexts);
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
