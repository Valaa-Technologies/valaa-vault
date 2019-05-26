// @flow

import { dumpObject, outputError, wrapError } from "~/tools/wrapError";

const inBrowser = require("~/gateway-api/inBrowser").default;

export default class FabricEvent {
  // HTML DOM Event interface fields
  type: string;
  timeStamp: number;
  isTrusted: boolean;

  bubbles: boolean;
  cancelable: boolean;
  // cancelBubble: boolean; // deprecated alias of stopPropagation
  // composed: boolean;

  target: EventTarget;

  eventPhase: number;

  currentTarget: EventTarget;
  // deepPath: Object[];

  defaultPrevented: boolean;
  // returnValue: boolean; // deprecated alias of defaultPrevented

  // 'error' type fields
  message: ?string;
  filename: ?string;
  lineno: ?number;
  colno: ?number;
  error: ?Error;

  constructor (type: string, fields: Object) {
    this.type = type;
    this.dispatch = false;
    this.bubbles = true;
    this.cancelable = true;
    if (fields) Object.assign(this, fields);
  }

  preventDefault () { if (this.cancelable && !this._passive) this.defaultPrevented = true; }
  stopPropagation () { this._stopPropagation = true; }
  stopImmediatePropagation () { this._stopPropagation = true; this._stopImmediate = true; }

  initEvent (type: string, bubbles: boolean, cancelable: boolean, detail: any) {
    if (this.dispatch) return;
    this.eventPhase = 0; // NONE
    this.type = type;
    this.bubbles = bubbles;
    this.cancelable = cancelable;
    this.detail = detail;
    this.defaultPrevented = false;
    this.target = null;
    this.currentTarget = null;
    this._stopPropagation = false;
    this._stopImmediate = false;
  }
}

export class FabricEventLogger {
  constructor () {
    if (!this.log) this.log = console.log.bind(console);
    if (!this.warn) this.warn = console.warn.bind(console);
    if (!this.error) this.error = console.error.bind(console);
    if (!this.info) this.info = console.info.bind(console);
    if (!this.clock) this.clock = (inBrowser() ? console.log : console.warn).bind(console);
  }
  log: Function;
  warn: Function;
  error: Function;
  info: Function;
  clock: Function;
}

let _eventTargetCounter = 0;
let _clockerId = 0;

export const FabricEventTypesTag = Symbol("FabricEvent.Types");
const FabricEventTargetTag = Symbol("FabricEvent.EventListener.EventTarget");

export class FabricEventTarget {
  _name: string;
  _verbosity: ?number;
  _logger: FabricEventLogger | Object;

  constructor (name, verbosity, logger) {
    this._name = name || `${this.constructor.name}#${++_eventTargetCounter}`;
    this._verbosity = verbosity || 0;
    this._logger = logger || console;
  }

  fork (overrides: any) {
    const ret = Object.create(this);
    if (overrides) Object.assign(ret, overrides);
    return ret;
  }

  getLogger (): FabricEventLogger | Object { return this._logger; }
  setLogger (logger: FabricEventLogger) { this._logger = logger; }
  getName (): string { return this._name; }
  getRawName (): string { return this._name; }
  setName (name: any) { this._name = name; }

  getVerbosity () { return this._verbosity; }
  setVerbosity (value: number) { this._verbosity = value; }

  debugId (opts): string {
    return `${this.constructor.name}(${!(opts || {}).raw ? this.getName() : this.getRawName()})`;
  }

  info (...rest: any[]) {
    return (this._logger.info || this._logger.log).apply(this._logger, rest);
  }
  log (...rest: any[]) { return this._logger.log(...rest); }
  warn (...rest: any[]) { return this._logger.warn(...rest); }
  error (...rest: any[]) { return this._logger.error(...rest); }
  clock (...rest: any[]) {
    return (this._logger.clock || (inBrowser() ? this._logger.log : this._logger.warn))
        .apply(this._logger, rest);
  }

  infoEvent (minVerbosity: any, maybeFunction: any, ...messagePieces: any[]) {
    if ((typeof minVerbosity === "number") && (minVerbosity > this._verbosity)) return this;
    return this._outputMessageEvent(this.info.bind(this),
        true, minVerbosity, maybeFunction, ...messagePieces);
  }
  logEvent (minVerbosity: any, maybeFunction: any, ...messagePieces: any[]) {
    if ((typeof minVerbosity === "number") && (minVerbosity > this._verbosity)) return this;
    return this._outputMessageEvent(this.log.bind(this),
        true, minVerbosity, maybeFunction, ...messagePieces);
  }
  warnEvent (minVerbosity: any, maybeFunction: any, ...messagePieces: any[]) {
    if ((typeof minVerbosity === "number") && (minVerbosity > this._verbosity)) return this;
    return this._outputMessageEvent(this.warn.bind(this),
        true, minVerbosity, maybeFunction, ...messagePieces);
  }
  errorEvent (minVerbosity: any, maybeFunction: any, ...messagePieces: any[]) {
    if ((typeof minVerbosity === "number") && (minVerbosity > this._verbosity)) return this;
    return this._outputMessageEvent(this.error.bind(this),
        true, minVerbosity, maybeFunction, ...messagePieces);
  }
  clockEvent (minVerbosity: any, maybeFunction: any, ...messagePieces: any[]) {
    if ((typeof minVerbosity === "number") && (minVerbosity > this._verbosity)) return this;
    return this._outputMessageEvent(this.clock.bind(this),
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
    const clockerId = _clockerId++;
    return [].concat(...thenChainCallbacks.map((callback, index) => [
      ...(!callback.name ? [] : [head => {
        this.clockEvent(minVerbosity, `${eventPrefix}#${clockerId}[${index}]`, callback.name);
        return head;
      }]),
      callback,
    ]),
    result => {
      this.clockEvent(minVerbosity, `${eventPrefix}#${clockerId}.done`, "");
      return result;
    });
  }

  // Fabric EventTarget API

  addEventListener (type: String, callback: Function | Object, options: ?(boolean | Object) = {}) {
    const eventType = this[FabricEventTypesTag][type];
    if (!eventType) {
      throw new Error(`${this.constructor.name} doesn't implement event type '${type}'`);
    }
    const listenerName = `on${type}`;
    let listeners = this[listenerName];
    if (!listeners || (listeners[FabricEventTargetTag] !== this)) {
      listeners = (this[listenerName] = []);
      listeners[FabricEventTargetTag] = this;
    }
    const listener = (typeof callback !== "function") ? callback
        : _createListener(type, callback, options);
    if (listeners.find(_matchesListener.bind(null, listener))) return;
    listeners.push(listener);
  }

  removeEventListener (type: String, callback: Function, options: ?(boolean | Object)) {
    const listenerName = `on${type}`;
    const listeners = this[listenerName];
    if (!listeners || (listeners[FabricEventTargetTag] !== this)) return;
    const listener = (typeof callback !== "function") ? callback
        : _createListener(type, callback, options);
    const index = listeners.findIndex(_matchesListener.bind(null, listener));
    if (index !== -1) listeners.splice(index, 1)[0].removed = true;
    if (!listeners.length) delete this[listenerName];
  }

  dispatchEvent (fabricEvent: Event) {
    const listenerName = `on${fabricEvent.type}`;
    fabricEvent.dispatch = true;
    fabricEvent.path = [];
    // Not implemented:
    // touchTargets, targetOverride, isActivationEvent, relatedTarget, slotable
    for (let listeners, target_ = this; (listeners = target_[listenerName]);) { // eslint-disable-line
      let target = listeners[FabricEventTargetTag];
      if (!target) {
        for (target = target_;
            !target.hasOwnProperty(listenerName);
            target = Object.getPrototypeOf(target));
        listeners = [{ type: fabricEvent.type, callback: listeners }];
      }
      fabricEvent.path.push({ target, listeners });
      target_ = Object.getPrototypeOf(target);
    }
    fabricEvent.target = this;
    for (let i = fabricEvent.path.length; i--;) {
      const pathEntry = fabricEvent.path[i];
      // AT_TARGET or CAPTURING_PHASE
      fabricEvent.eventPhase = (pathEntry.eventTarget === this) ? 2 : 1;
      if (!_deliver(pathEntry, fabricEvent, "capturing")) break;
    }
    if (fabricEvent.bubbles && !fabricEvent._stopPropagation) {
      for (let i = 0; i !== fabricEvent.path.length; ++i) {
        const pathEntry = fabricEvent.path[i];
        // AT_TARGET or BUBBLING_PHASE
        fabricEvent.eventPhase = (pathEntry.eventTarget === this) ? 2 : 3;
        if (!_deliver(pathEntry, fabricEvent, "bubbling")) break;
      }
    }
    fabricEvent.dispatch = false;
    const ret = !fabricEvent.defaultPrevented;
    fabricEvent.initEvent(
        fabricEvent.type, fabricEvent.bubbles, fabricEvent.cancelable, fabricEvent.detail);
    return ret;
  }

  obtainDispatchAndDefaultActEvent (reuseFabricEvent: Event, type: string, updateFields: Object) {
    const eventType = this[FabricEventTypesTag][type];
    if (!eventType) {
      throw new Error(`${this.constructor.name} doesn't implement fabric event type '${type}'`);
    }
    const fabricEvent = reuseFabricEvent || new FabricEvent(type);
    fabricEvent.initEvent(type, eventType.bubbles, eventType.cancelable);
    if (updateFields) Object.assign(fabricEvent, updateFields);
    this.dispatchAndDefaultActEvent(fabricEvent, eventType);
    return fabricEvent;
  }

  dispatchAndDefaultActEvent (fabricEvent: FabricEvent,
      eventType = this[FabricEventTypesTag][fabricEvent.type]) {
    if (!eventType) {
      throw new Error(
          `${this.constructor.name} doesn't implement fabric event type '${fabricEvent.type}'`);
    }
    if (!this.dispatchEvent(fabricEvent)) return false;
    const defaultAction = eventType.defaultAction;
    if (defaultAction) {
      if (defaultAction.setIfUndefined) {
        for (const key of Object.keys(defaultAction.setIfUndefined)) {
          if (fabricEvent[key] === undefined) fabricEvent[key] = defaultAction.setIfUndefined[key];
        }
      }
      if (defaultAction.setAlways) {
        for (const key of Object.keys(defaultAction.setAlways)) {
          fabricEvent[key] = defaultAction.setAlways[key];
        }
      }
      if (defaultAction.call) {
        for (const entry of defaultAction.call) {
          const func = Array.isArray(entry) ? entry[0] : entry;
          const args = Array.isArray(entry) ? entry.slice(1) : [];
          if (typeof func === "string") this[func](fabricEvent, ...args);
          else if (typeof func === "function") func.call(this, fabricEvent, ...args);
        }
      }
    }
    return true;
  }
}

FabricEventTarget.prototype[FabricEventTypesTag] = {};

function _createListener (type, callback, options) {
  return {
    type,
    callback,
    capture: (typeof options === "boolean") ? options : options.capture,
    passive: !!options.passive,
    once: !!options.once,
    removed: false,
  };
}

// as per https://dom.spec.whatwg.org/#add-an-event-listener clause 3.
function _matchesListener (lhs, rhs) {
  return (lhs.type === rhs.type) && (lhs.callback === rhs.callback)
      && (lhs.capture === rhs.capture);
}

function _deliver (pathEntry, fabricEvent, phase) {
  if (fabricEvent._stopPropagation) return false;
  const currentTarget = fabricEvent.currentTarget = pathEntry.target;
  for (const listener of [...pathEntry.listeners]) {
    if (listener.removed
        || ((phase === "capturing") && !listener.capture)
        || ((phase === "bubbling") && listener.capture)) continue;
    if (listener.once) currentTarget.removeEventListener(listener.type, listener);
    // there's no Realm semantics yet
    // "let 'global' be listener callback's associated Realm's global Object"
    if (listener.passive) fabricEvent._passive = true;
    try {
      if (typeof listener.callback === "function") {
        listener.callback(fabricEvent, currentTarget);
      } else {
        listener.callback.handleEvent(fabricEvent, currentTarget);
      }
    } catch (error) {
      currentTarget.outputErrorEvent(wrapError(error,
              new Error(`dispatchEvent(${fabricEvent.type})`),
              "\n\tfabricEvent:", ...dumpObject(fabricEvent),
              "\n\tlistener:", ...dumpObject(listener)),
          "Exception caught during fabric eventListener callback invokation");
    }
    fabricEvent._passive = false;
    if (fabricEvent._stopImmediate) break;
  }
  return !fabricEvent._stopPropagation;
}
