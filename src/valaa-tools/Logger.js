// @flow

import SimpleData from "~/valaa-tools/SimpleData";
import wrapError, { outputError } from "~/valaa-tools/wrapError";

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

  infoEvent (...messagePieces: any[]) {
    return this._logger.info(`${this.debugId()}:`, ...messagePieces);
  }
  logEvent (...messagePieces: any[]) {
    return this._logger.log(`${this.debugId()}:`, ...messagePieces);
  }
  warnEvent (...messagePieces: any[]) {
    return this._logger.warn(`${this.debugId()}:`, ...messagePieces);
  }
  errorEvent (...messagePieces: any[]) {
    return this._logger.error(`${this.debugId()}:`, ...messagePieces);
  }
  wrapErrorEvent (error: Error, functionName: string, ...contexts: any[]) {
    error.frameListClipDepth = 5;
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
