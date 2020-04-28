// @flow

import { dumpObject, outputError, outputCollapsedError, wrapError } from "~/tools/wrapError";
import { thisChainEagerly } from "~/tools/thenChainEagerly";

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
  debug: Function;
  info: Function;
  log: Function;
  warn: Function;
  error: Function;
  clock: Function;
}

let _clockerId = 0;

const _typeInstanceCounter = {};

export const FabricEventTypesTag = Symbol("FabricEvent.Types");
const FabricEventTargetTag = Symbol("FabricEvent.EventListener.EventTarget");

export class FabricEventTarget {
  _parent: FabricEventTarget | Object;
  _verbosity: ?number;
  _name: ?string;

  constructor (parent, verbosity, name) {
    this._parent = parent;
    if (verbosity !== undefined) this._verbosity = verbosity;
    if (name !== undefined) this._name = name;
    if (!parent) {
      this._parent = Object.create(console);
      this._parent.getVerbosity = () => 0;
    } else if (!parent.warn) {
      throw new Error("Invalid FabricEventTarget parent: not a logger object (no .warn specified)");
    }
  }

  getParent () { return this._parent; }

  getName (): string {
    const name = this._name;
    if (name !== undefined) return name;
    return this.setNameFromTypeInstanceCount(this.constructor.name);
  }
  setName (name: any) { this._name = name; }
  getRawName (): string { return this._rawName || this.getName(); }
  setRawName (rawName: any) { this._rawName = rawName; }

  setNameFromTypeInstanceCount (typeName, suffix = "") {
    if (!_typeInstanceCounter[typeName]) _typeInstanceCounter[typeName] = 0;
    return (this._name = `${typeName}:${++_typeInstanceCounter[typeName]}${suffix}`);
  }

  getVerbosity () {
    const ret = this._verbosity;
    return (ret != null) ? ret : this._parent.getVerbosity();
  }
  setVerbosity (value: number) { this._verbosity = value; }

  debugId (opts): string {
    return `${this.constructor.name}(${!(opts || {}).raw ? this.getName() : this.getRawName()})`;
  }

  debug (...rest: any[]) {
    return (this._parent.debug || this._parent.log).apply(this._parent, rest);
  }
  info (...rest: any[]) {
    return (this._parent.info || this._parent.log).apply(this._parent, rest);
  }
  log (...rest: any[]) { return this._parent.log(...rest); }
  warn (...rest: any[]) { return this._parent.warn(...rest); }
  error (...rest: any[]) { return this._parent.error(...rest); }
  clock (...rest: any[]) {
    return (this._parent.clock || (inBrowser() ? this._parent.log : this._parent.warn))
        .apply(this._parent, rest);
  }

  debugEvent (firstPartOrMinVerbosity: number | any, ...rest: any[]) {
    if (!_isVerboseEnough(firstPartOrMinVerbosity, this._verbosity, this)) return this;
    return this._outputMessageEvent((this._parent || this).debug.bind(this._parent || this),
        true, this._getMessageParts(firstPartOrMinVerbosity, rest));
  }
  infoEvent (firstPartOrMinVerbosity: number | any, ...rest: any[]) {
    if (!_isVerboseEnough(firstPartOrMinVerbosity, this._verbosity, this)) return this;
    return this._outputMessageEvent((this._parent || this).info.bind(this._parent || this),
        true, this._getMessageParts(firstPartOrMinVerbosity, rest));
  }
  logEvent (firstPartOrMinVerbosity: number | any, ...rest: any[]) {
    if (!_isVerboseEnough(firstPartOrMinVerbosity, this._verbosity, this)) return this;
    return this._outputMessageEvent((this._parent || this).log.bind(this._parent || this),
        true, this._getMessageParts(firstPartOrMinVerbosity, rest));
  }
  warnEvent (firstPartOrMinVerbosity: number | any, ...rest: any[]) {
    if (!_isVerboseEnough(firstPartOrMinVerbosity, this._verbosity, this)) return this;
    return this._outputMessageEvent((this._parent || this).warn.bind(this._parent || this),
        true, this._getMessageParts(firstPartOrMinVerbosity, rest));
  }
  errorEvent (firstPartOrMinVerbosity: number | any, ...rest: any[]) {
    if (!_isVerboseEnough(firstPartOrMinVerbosity, this._verbosity, this)) return this;
    return this._outputMessageEvent((this._parent || this).error.bind(this._parent || this),
        true, this._getMessageParts(firstPartOrMinVerbosity, rest));
  }
  clockEvent (firstPartOrMinVerbosity: number | any, ...rest: any[]) {
    if (!_isVerboseEnough(firstPartOrMinVerbosity, this._verbosity, this)) return this;
    return this._outputMessageEvent(this.clock.bind(this),
        false, this._getMessageParts(firstPartOrMinVerbosity, rest));
  }

  _getMessageParts (maybeMinVerbosity, rest) {
    return (typeof maybeMinVerbosity !== "number")
            ? [maybeMinVerbosity, ...(rest || [])]
        : rest && (typeof rest[0] === "function")
            ? [].concat(rest[0](), rest.slice(1))
        : rest || [];
  }

  _outputMessageEvent (output: Function, joinFirstPieceWithId: boolean, parts: any[]) {
    // Prepend the debug id to the first entry if it is a string.
    // Valma logger gives only the first argument a specific coloring,
    // this way the actual first piece will get the coloring as well.
    const first = parts[0];
    return (typeof first !== "string" || !joinFirstPieceWithId)
        ? output(`${this.debugId({ raw: !joinFirstPieceWithId })}:`, ...parts)
        : output(`${this.debugId({ raw: !joinFirstPieceWithId })}: ${first}`, ...parts.slice(1));
  }

  wrapErrorEvent (error: Error, nameOrMinVerbosity: Error | string | number, ...contexts_: any[]) {
    const [functionName, ...contexts] = this._getMessageParts(nameOrMinVerbosity, contexts_);
    const actualFunctionName = functionName instanceof Error ? functionName.message : functionName;
    if (error.hasOwnProperty("functionName")
        && (error.functionName === actualFunctionName)
        && (error.contextObject === this)) {
      // Don't re-wrap the error if it's already wrapped with the same
      // functionName in the same context.
      return error;
    }
    const wrapper = (functionName instanceof Error) ? functionName : new Error("");
    if (!wrapper.tidyFrameList) {
      wrapper.tidyFrameList = wrapper.stack.split("\n")
          .slice((functionName instanceof Error) ? 2 : 3);
      wrapper.logger = this;
    }
    if (typeof nameOrMinVerbosity === "number") {
      wrapper.verbosities = [this.getVerbosity(), nameOrMinVerbosity];
    }
    let ret;
    if (!_isVerboseEnough(nameOrMinVerbosity, this._verbosity, this)) {
      wrapper.message = `${wrapper.verbosities ? `[${wrapper.verbosities.join("<")}] ` : ""
        }fabric error context hidden from .${actualFunctionName}`;
      ret = wrapError(error, wrapper);
    } else {
      wrapper.message = `${wrapper.verbosities ? `[${wrapper.verbosities.join(">=")}] ` : ""
        }Error context by \n  ${actualFunctionName}${contexts.length ? ", with:" : ""}`;
      ret = wrapError(error, wrapper, ...contexts);
    }
    ret.functionName = actualFunctionName;
    ret.contextObject = this;
    return ret;
  }

  outputErrorEvent (error: Error, firstMessageOrMinVerbosity, ...restMessages) {
    return (!_isVerboseEnough(firstMessageOrMinVerbosity, this._verbosity, this)
            ? outputCollapsedError
            : outputError)(
        error,
        this._getMessageParts(firstMessageOrMinVerbosity, restMessages).join(", "),
        this);
  }

  performChain (params: any, staticChainName: string, staticErrorHandlerName: string,
      customVerbosity: ?number) {
    let chain = this.constructor[staticChainName];
    if (!chain) {
      throw new Error(`performChain can't find chain '${staticChainName}' from ${
          this.constructor.name} statics`);
    }
    let errorHandler;
    if (staticErrorHandlerName) {
      errorHandler = this[staticErrorHandlerName];
      if (!errorHandler) {
        throw new Error(`performChain can't find error handler '${
            staticErrorHandlerName}' from ${this.constructor.name} non-statics`);
      }
    }
    if (this._verbosity >= (customVerbosity || 2)) {
      chain = this.addChainClockers(customVerbosity || 2, staticChainName, chain, true);
    }
    return thisChainEagerly(this, params, chain, errorHandler);
  }

  addChainClockers (minVerbosity: number, eventPrefix: string, thenChainCallbacks: Function[],
      isThisChain: boolean) {
    if (!(this.getVerbosity() >= minVerbosity)) return thenChainCallbacks;
    const clockerId = _clockerId++;
    return [].concat(...thenChainCallbacks.map((callback, index) => [
      ...(!callback.name ? [] : [(...params) => {
        this.clockEvent(minVerbosity, `${eventPrefix}#[${index}]:${callback.name}`, clockerId);
        return isThisChain ? params : params[0];
      }]),
      callback,
    ]),
    (...params) => {
      this.clockEvent(minVerbosity, `${eventPrefix}.done`, clockerId);
      return isThisChain ? params : params[0];
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

function _isVerboseEnough (maybeMinVerbosity, verbosity, eventTarget) {
  return (typeof maybeMinVerbosity !== "number")
      || (maybeMinVerbosity <= (verbosity !== undefined ? verbosity : eventTarget.getVerbosity()));
}

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
