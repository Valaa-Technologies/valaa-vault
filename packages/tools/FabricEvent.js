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
    this.type = type;
    this.bubbles = bubbles;
    this.cancelable = cancelable;
    this.detail = detail;
    this.reinitEvent();
  }
  reinitEvent () {
    this.eventPhase = 0; // NONE
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

const _typeInstanceCounter = {};

export const FabricEventTypesTag = Symbol("FabricEvent.Types");
const FabricEventTargetTag = Symbol("FabricEvent.EventListener.EventTarget");
export const FabricDispatchPathTag = Symbol("FabricEvent.EventListener.DispatchPath");

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
    return (this._name = `${typeName}$.${++_typeInstanceCounter[typeName]}${suffix}`);
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
    return (this._parent.clock || (inBrowser() ? this._parent.debug : this._parent.warn))
        .apply(this._parent, rest);
  }

  debugEvent (firstPartOrDetailLevel: number | any, ...rest: any[]) {
    if (_adjustDetailLevel(firstPartOrDetailLevel, this._verbosity, this) > 0) return this;
    return this._outputMessageEvent((this._parent || this).debug.bind(this._parent || this),
        true, this._getMessageParts(firstPartOrDetailLevel, rest));
  }
  infoEvent (firstPartOrDetailLevel: number | any, ...rest: any[]) {
    if (_adjustDetailLevel(firstPartOrDetailLevel, this._verbosity, this) > 0) return this;
    return this._outputMessageEvent((this._parent || this).info.bind(this._parent || this),
        true, this._getMessageParts(firstPartOrDetailLevel, rest));
  }
  logEvent (firstPartOrDetailLevel: number | any, ...rest: any[]) {
    if (_adjustDetailLevel(firstPartOrDetailLevel, this._verbosity, this) > 0) return this;
    return this._outputMessageEvent((this._parent || this).log.bind(this._parent || this),
        true, this._getMessageParts(firstPartOrDetailLevel, rest));
  }
  warnEvent (firstPartOrDetailLevel: number | any, ...rest: any[]) {
    if (_adjustDetailLevel(firstPartOrDetailLevel, this._verbosity, this) > 0) return this;
    return this._outputMessageEvent((this._parent || this).warn.bind(this._parent || this),
        true, this._getMessageParts(firstPartOrDetailLevel, rest));
  }
  errorEvent (firstPartOrDetailLevel: number | any, ...rest: any[]) {
    if (_adjustDetailLevel(firstPartOrDetailLevel, this._verbosity, this) > 0) return this;
    return this._outputMessageEvent((this._parent || this).error.bind(this._parent || this),
        true, this._getMessageParts(firstPartOrDetailLevel, rest));
  }

  static _globalOps = Object.create(null);

  opLog (requiredVerbosity, parentLogOrOptionsOrName = this, operationName, ...rest) {
    let verbosity = parentLogOrOptionsOrName.verbosity || 0;
    if (this._verbosity > verbosity) verbosity = this._verbosity;
    const loudness = verbosity - requiredVerbosity;
    if (loudness < 0) return undefined;
    let parentOpLog;
    if (typeof parentLogOrOptionsOrName === "string") {
      return this.opLog(requiredVerbosity, this, parentLogOrOptionsOrName, operationName, ...rest);
    }
    if (parentLogOrOptionsOrName instanceof FabricEventTarget) {
      parentOpLog = parentLogOrOptionsOrName;
    } else {
      parentOpLog = parentLogOrOptionsOrName.plog || this;
    }
    const ret = Object.create(this);
    ret._verbosity = ret.verbosity = verbosity;
    ret._loudness = loudness;
    const parentPlot = parentOpLog._opLogPlot || "";
    const ops = parentPlot
        ? parentOpLog._opLogOps || (parentOpLog._opLogOps = Object.create(null))
        : FabricEventTarget._globalOps;
    const index = ops[operationName] || 0;
    ops[operationName] = index + 1;
    ret._opLogPlot = `${parentPlot}@-:${operationName}:${index}`;
    for (let i = verbosity; i; --i) ret[`v${i}`] = ret;
    if (rest.length) ret.opEvent(this, "", ...rest);
    return ret;
  }

  opEvent (target: Object | string, eventName: string, ...rest: any[]) {
    if (typeof target !== "object") {
      return this.opEvent(this, target, ...(eventName === undefined ? [] : [eventName]), ...rest);
    }
    if (typeof eventName !== "string") {
      throw new Error(`Invalid opEvent..eventName: expected string, got ${typeof eventName}`);
    }
    return target._outputMessageEvent(this.clock.bind(this), false, [].concat(
        `${this._verbosity || 0}>=${(this._verbosity || 0) - this._loudness}`,
        `${this._opLogPlot}${!eventName ? "" : `@:${eventName}`}@@`,
        ...(!rest.length ? []
            : (!this._loudness && !inBrowser()) ? [":", rest[0]]
            : [":\n\t", ...rest.map(e => (typeof e === "string" ? e : dumpObject(e)))]
        )));
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

  wrapErrorEvent (error: Error, detailLevel: number, name: Error | string, ...contexts_: any[]) {
    if (typeof detailLevel !== "number") {
      return this.wrapErrorEvent(error, 0, name, ...contexts_);
    }
    const adjustedDetailLevel = _adjustDetailLevel(detailLevel, this._verbosity, this);
    if (adjustedDetailLevel > 2) return error; // no wrap.
    if ((error == null) || !error.hasOwnProperty) {
      console.error("wrapErrorEvent.error must be an object, got:", error);
      throw new Error("wrapErrorEvent.error must be an object. See console.log for details");
    }
    const [functionName, ...contexts] = typeof name === "function" ? name() : [name, ...contexts_];
    const actualFunctionName = functionName instanceof Error ? functionName.message : functionName;
    if (error.hasOwnProperty("functionName")
        && (error.functionName === actualFunctionName)
        && (error.contextObject === this)) {
      // Don't re-wrap the error if it's already wrapped with the same
      // functionName in the same context.
      return error;
    }
    const wrapper = (functionName instanceof Error) ? functionName : new Error(actualFunctionName);
    if (!wrapper.tidyFrameList) {
      wrapper.tidyFrameList = wrapper.stack.split("\n")
          .slice((functionName instanceof Error) ? 2 : 3);
      wrapper.logger = this;
    }
    if (error.hasOwnProperty("_frameStackError")) wrapper.stack = error._frameStackError.stack;
    wrapper.detailAdjustment = adjustedDetailLevel - detailLevel;
    const ret = wrapError(error, detailLevel, ...contexts);
    ret.functionName = actualFunctionName;
    ret.contextObject = this;
    return ret;
  }

  outputErrorEvent (error: Error, firstMessageOrDetailLevel, ...restMessages) {
    return (_adjustDetailLevel(firstMessageOrDetailLevel, this._verbosity, this) > 0
            ? outputCollapsedError
            : outputError)(
        error,
        this._getMessageParts(firstMessageOrDetailLevel, restMessages).join(", "),
        this);
  }

  static _returnParamsError = new Error("return original params hack");

  opChain (chainOrStaticName: string, params: any,
      errorHandlerOrName: string, parentOpLog: ?Object, minVerbosity: ?number = 2) {
    let chain = (typeof chainOrStaticName !== "string"
        ? chainOrStaticName
        : this.constructor[chainOrStaticName]);
    if (!chain) {
      throw new Error(`opChain can't find chain '${chainOrStaticName}' from ${
          this.constructor.name} static class properties`);
    }
    let errorHandler, stackError;
    const verbosity = this.getVerbosity();
    if (parentOpLog) parentOpLog.chain = null;
    if (verbosity >= minVerbosity) {
      chain = this._addChainClockers(parentOpLog, minVerbosity,
          chainOrStaticName.name || chainOrStaticName, chain);
    }
    if (verbosity) stackError = new Error("stack");
    return thisChainEagerly(this, params, chain, (error, index, innerParams, ...rest) => {
      if (error === FabricEventTarget._returnParamsError) return innerParams;
      if (!errorHandler && errorHandlerOrName) {
        errorHandler = (typeof errorHandlerOrName !== "string")
            ? errorHandlerOrName
            : this[errorHandlerOrName];
        if (!errorHandler) {
          throw new Error(`opChain can't find error handler '${errorHandlerOrName
              }' from ${this.constructor.name} non-static instance properties`);
        }
      }
      if (stackError) error._frameStackError = stackError;
      if (!errorHandler) throw error;
      return errorHandler.call(this, error, index, innerParams, ...rest);
    });
  }

  _addChainClockers (parentOpLog, minVerbosity: number, eventPrefix: string,
      thenChainCallbacks: Function[]) {
    const chainOpLog = this.opLog(minVerbosity, parentOpLog, eventPrefix);
    if (!chainOpLog) return thenChainCallbacks;
    return [].concat(...thenChainCallbacks.map((callback, index) => {
      if (!callback) {
        throw new Error("callback missing in addChainClockers:", thenChainCallbacks);
      }
      return [
        ...(!callback || !callback.name ? [] : [
          (...params) => {
            if (parentOpLog) parentOpLog.chain = chainOpLog;
            chainOpLog.opEvent(this, `${index}:${callback.name}`,
                `op: ${callback.name}`, ...(!chainOpLog.v3
                    ? [`(as ${eventPrefix} op #${index})`]
                    : [].concat(...params.map((e, i) =>
                        [!i ? "(" : `\n\t  ${" ".repeat(callback.name.length)},`, e]), ")")));
            return params;
          },
        ]),
        callback,
      ];
    }), (...params) => {
      chainOpLog.opEvent(this, "done",
          `done: ${eventPrefix}`, ...params);
      if (parentOpLog) parentOpLog.chain = null;
      // This is a hack to ensure that the chain returns a single-param
      // array or direct object as returned by the last chain callback.
      throw FabricEventTarget._returnParamsError;
    });
  }

  // Fabric EventTarget API

  addEventListener (type: String, callback: Function | Object, options: ?(boolean | Object) = {}) {
    const eventType = this[FabricEventTypesTag][type];
    if (!eventType) {
      throw new Error(`${this.constructor.name} doesn't implement event type '${type}'`);
    }
    const listenerName = `on${type}`;
    const listener = (typeof callback !== "function") ? callback
        : _createListener(type, callback, options);
    let listeners = this[listenerName];
    if (!listeners || (listeners[FabricEventTargetTag] !== this)) {
      listeners = (this[listenerName] = [listener]);
      listeners[FabricEventTargetTag] = this;
    } else if (!listeners.find(_matchesListener.bind(null, listener))) {
      listeners.push(listener);
    }
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

  dispatchEvent (fabricEvent: Event, {
    dispatchPath = generateDispatchEventPath(this, fabricEvent.type),
  } = {}) {
    if (!dispatchPath) return true;
    fabricEvent.dispatch = true;
    fabricEvent.path = dispatchPath;
    // Not implemented:
    // touchTargets, targetOverride, isActivationEvent, relatedTarget, slotable
    fabricEvent.target = this;
    for (let i = fabricEvent.path.length; i--;) {
      const pathEntry = fabricEvent.path[i];
      // AT_TARGET or CAPTURING_PHASE
      fabricEvent.eventPhase = (pathEntry.target === this) ? 2 : 1;
      if (!_deliver(pathEntry, fabricEvent, "capturing")) break;
    }
    if (fabricEvent.bubbles && !fabricEvent._stopPropagation) {
      for (let i = 0; i !== fabricEvent.path.length; ++i) {
        const pathEntry = fabricEvent.path[i];
        // AT_TARGET or BUBBLING_PHASE
        fabricEvent.eventPhase = (pathEntry.target === this) ? 2 : 3;
        if (!_deliver(pathEntry, fabricEvent, "bubbling")) break;
      }
    }
    fabricEvent.dispatch = false;
    const ret = !fabricEvent.defaultPrevented;
    fabricEvent.reinitEvent();
    return ret;
  }

  setGenerateOuterPathCallback (callback) {
    this._generateOuterPath = callback;
  }

  obtainDispatchAndDefaultActEvent (reuseFabricEvent: Event, type: string, updateFields: Object) {
    const eventType = this[FabricEventTypesTag][type];
    if (!eventType) {
      throw new Error(`${this.constructor.name} doesn't implement fabric event type '${type}'`);
    }
    const fabricEvent = reuseFabricEvent || new FabricEvent(type);
    fabricEvent.initEvent(type, eventType.bubbles, eventType.cancelable);
    if (updateFields) Object.assign(fabricEvent, updateFields);
    this.dispatchAndDefaultActEvent(fabricEvent, { eventType });
    return fabricEvent;
  }

  dispatchAndDefaultActEvent (fabricEvent: FabricEvent, options = {}) {
    return this.dispatchEvent(fabricEvent, options)
        && this.defaultActEvent(fabricEvent, options);
  }

  defaultActEvent (fabricEvent, options = {}) {
    let eventType = options.eventType;
    if (!eventType) {
      eventType = this[FabricEventTypesTag][fabricEvent.type];
      if (!eventType) {
        throw new Error(
          `${this.constructor.name} doesn't implement fabric event type '${fabricEvent.type}'`);
      }
    }
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

export function generateDispatchEventPath (
    eventTarget, eventType, targetPropertyName = `on${eventType}`, cachePathAtEventTarget = false) {
  if (!eventTarget) return undefined;
  let ret;
  let outerPath;
  for (let listeners, targetSeeker = eventTarget; (listeners = targetSeeker[targetPropertyName]);) { // eslint-disable-line
    let target = listeners[FabricEventTargetTag];
    if (!target) {
      for (target = targetSeeker;
          !target.hasOwnProperty(targetPropertyName);
          target = Object.getPrototypeOf(target));
      listeners = [_createListener(eventType, listeners, {})];
      listeners[FabricEventTargetTag] = target;
      target[targetPropertyName] = listeners;
    } else {
      outerPath = listeners[FabricDispatchPathTag];
      if (outerPath) break;
    }
    (ret || (ret = [])).push({ target, listeners });
    targetSeeker = Object.getPrototypeOf(target);
  }
  if (!outerPath && eventTarget._generateOuterPath) {
    outerPath = eventTarget._generateOuterPath(eventType, targetPropertyName);
  }
  if (outerPath) {
    if (!ret) ret = outerPath;
    else ret.push(...outerPath);
  }
  if (cachePathAtEventTarget && ret) {
    ret[0].listeners[FabricDispatchPathTag] = ret;
  }
  return ret;
}


FabricEventTarget.prototype[FabricEventTypesTag] = {};

function _adjustDetailLevel (maybeDetailLevel, verbosity, eventTarget) {
  return ((typeof maybeDetailLevel !== "number") ? 0 : maybeDetailLevel)
      - (verbosity !== undefined ? verbosity : eventTarget.getVerbosity());
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
      (currentTarget.outputErrorEvent
              ? currentTarget.outputErrorEvent.bind(currentTarget)
              : console.error.bind(console))(
          wrapError(error,
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
