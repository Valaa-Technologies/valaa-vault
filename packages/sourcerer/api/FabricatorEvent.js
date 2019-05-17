// @flow

import type Connection from "./Connection";

import { dumpObject, wrapError } from "~/tools";

export default class FabricatorEvent {
  // HTML Event interface fields
  type: string;
  timeStamp: number;
  isTrusted: boolean;

  bubbles: boolean;
  cancelable: boolean;
  // cancelBubble: boolean; // deprecated alias of stopPropagation
  // composed: boolean;

  target: EventTarget;

  eventPhase: string;

  currentTarget: EventTarget;
  // deepPath: Object[];

  defaultPrevented: boolean;
  // returnValue: boolean; // deprecated alias of defaultPrevented

  preventDefault () { if (this.cancelable && !this._passive) this.defaultPrevented = true; }
  stopPropagation () { this._stopPropagation = true; }
  stopImmediatePropagation () { this._stopPropagation = true; this._stopImmediate = true; }

  // FabricatorEvent fields
  connection: Connection;
  command: Object;
  action: ?Object;
  prophecy: ?Object;

  // 'error' type fields
  message: string;
  filename: string;
  lineno: number;
  colno: number;
  error: Error;

  // reformation fields
  isSchismatic: ?boolean;
  isRevisable: ?boolean;
  retryWhen: ?string;

  constructor (type: string, connection: ?Connection, fields: Object) {
    this.dispatch = false;
    this.type = type;
    this.connection = connection;
    this.bubbles = true;
    this.cancelable = true;
    Object.assign(this, fields);
  }

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

const EventTargetTag = Symbol("FabricatorEvent.EventListener.EventTarget");

export const prototypeTreeEventTargetOps = {
  addEventListener (type: String, callback: Function | Object, options: ?(boolean | Object)) {
    const listenerName = `on${type}`;
    let listeners = this[listenerName];
    if (!listeners || (listeners[EventTargetTag] !== this)) {
      listeners = (this[listenerName] = []);
      listeners[EventTargetTag] = this;
    }
    const listener = (typeof callback !== "function") ? callback
        : _createListener(type, callback, options);
    if (listeners.find(_matchesListener.bind(null, listener))) return;
    listeners.push(listener);
  },

  removeEventListener (type: String, callback: Function, options: ?(boolean | Object)) {
    const listenerName = `on${type}`;
    const listeners = this[listenerName];
    if (!listeners || (listeners[EventTargetTag] !== this)) return;
    const listener = (typeof callback !== "function") ? callback
        : _createListener(type, callback, options);
    const index = listeners.findIndex(_matchesListener.bind(null, listener));
    if (index !== -1) listeners.splice(index, 1)[0].removed = true;
    if (!listeners.length) delete this[listenerName];
  },

  dispatchEvent (domEvent: Event) {
    const listenerName = `on${domEvent.type}`;
    domEvent.dispatch = true;
    domEvent.path = [];
    // Not implemented:
    // touchTargets, targetOverride, isActivationEvent, relatedTarget, slotable
    for (let listeners, target_ = this; (listeners = target_[listenerName]);) { // eslint-disable-line
      let target = listeners[EventTargetTag];
      if (!target) {
        for (target = target_;
            !target.hasOwnProperty(listenerName);
            target = Object.getPrototypeOf(target));
        listeners = [{ type: domEvent.type, callback: listeners }];
      }
      domEvent.path.push({ target, listeners });
      target_ = Object.getPrototypeOf(target);
    }
    domEvent.target = this;
    for (let i = domEvent.path.length; i--;) {
      const pathEntry = domEvent.path[i];
      domEvent.eventPhase = (pathEntry.eventTarget === this) ? 2 : 1; // AT_TARGET:CAPTURING_PHASE
      if (!_invoke(pathEntry, domEvent, "capturing")) break;
    }
    if (domEvent.bubbles && !domEvent._stopPropagation) {
      for (let i = 0; i !== domEvent.path.length; ++i) {
        const pathEntry = domEvent.path[i];
        domEvent.eventPhase = (pathEntry.eventTarget === this) ? 2 : 3; // AT_TARGET:BUBBLING_PHASE
        if (!_invoke(pathEntry, domEvent, "bubbling")) break;
      }
    }
    domEvent.dispatch = false;
    const ret = !domEvent.defaultPrevented;
    domEvent.initEvent(domEvent.type, domEvent.bubbles, domEvent.cancleable, domEvent.detail);
    return ret;
  },
};

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

function _invoke (pathEntry, domEvent, phase) {
  if (domEvent._stopPropagation) return false;
  const currentTarget = domEvent.currentTarget = pathEntry.target;
  for (const listener of [...pathEntry.listeners]) {
    if (listener.removed
        || ((phase === "capturing") && !listener.capture)
        || ((phase === "bubbling") && listener.capture)) continue;
    if (listener.once) currentTarget.removeEventListener(listener.type, listener);
    // there's no Realm semantics yet
    // "let 'global' be listener callback's associated Realm's global Object"
    if (listener.passive) domEvent._passive = true;
    try {
      if (typeof listener.callback === "function") {
        listener.callback(domEvent, currentTarget);
      } else {
        listener.callback.handleEvent(domEvent, currentTarget);
      }
    } catch (error) {
      currentTarget.outputErrorEvent(wrapError(error,
              new Error(`dispatchEvent(${domEvent.type})`),
              "\n\tdomEvent:", ...dumpObject(domEvent),
              "\n\tlistener:", ...dumpObject(listener)),
          "Exception caught during eventListener callback invokation");
    }
    domEvent._passive = false;
    if (domEvent._stopImmediate) break;
  }
  return !domEvent._stopPropagation;
}
