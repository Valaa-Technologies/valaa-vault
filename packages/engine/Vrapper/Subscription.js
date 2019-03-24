// @flow

import type { VALKOptions } from "~/raem/VALK";
import { HostRef, UnpackedHostValue } from "~/raem/VALK/hostReference";
import { addStackFrameToError, SourceInfoTag } from "~/raem/VALK/StackTrace";

import VRL from "~/raem/VRL";
import { tryConnectToMissingPartitionsAndThen } from "~/raem/tools/denormalized/partitions";

import { isNativeIdentifier, getNativeIdentifierValue } from "~/script";

import Vrapper from "~/engine/Vrapper";
import VALEK, { Kuery, dumpKuery, dumpObject } from "~/engine/VALEK";
import FieldUpdate, { LiveUpdate } from "~/engine/Vrapper/FieldUpdate";

import { invariantify, invariantifyObject, isSymbol, thenChainEagerly, wrapError } from "~/tools";

/**
 * Subscription is a shared object which represents a single live kuery
 * or field listeners. It has two main roles:
 * 1. a field handler registerer and a listener for specific field
 *    update notifications on Vrapper's
 * 2. subscriber tracker for top-level subscriber callback calls
 *
 * @export
 * @class Subscription
 * @extends {LiveUpdate}
 */
export default class Subscription extends LiveUpdate {
  // _valkOptions: VALKOptions;

  // _fieldName: string; // of LiveUpdate
  _liveHead: ?any;
  _liveKuery: ?Kuery;

  _fieldFilter: ?Function | ?boolean;

  _fieldListeners: Object;

  constructor (emitter: Vrapper, liveOperation: any, options: ?VALKOptions, head: any) {
    super(emitter);
    if ((typeof liveOperation === "object") || (options !== undefined) || (head !== undefined)) {
      // console.log("Kuery Sub created", emitter && emitter.debugId(), liveOperation);
      this._liveHead = (head !== undefined) ? head : emitter;
      this._liveKuery = liveOperation;
      this._valkOptions = options || {};
      // this._valkOptions.noSideEffects = true; // TODO(iridian): Implement this in Valker.
      if (liveOperation instanceof Kuery) {
        this._liveKueryObject = liveOperation;
        this._liveKuery = liveOperation.toVAKON();
        this._valkOptions.sourceInfo = liveOperation[SourceInfoTag];
      }
    } else if ((typeof liveOperation === "string") || isSymbol(liveOperation)) {
      // console.log("Field Sub created", emitter[0] && emitter[0].debugId(), liveOperation);
      this._fieldName = liveOperation;
    } else if ((typeof liveOperation === "boolean") || (typeof liveOperation === "function")) {
      // console.log("Filter Sub created", emitter[0] && emitter[0].debugId(), liveOperation);
      this._fieldFilter = liveOperation;
    } else {
      throw new Error(`Unrecognized liveOperation of type '${typeof liveOperation
        }'. Expected object, string, symbol, boolean or function`);
    }
    return this;
  }

  _subscribers = new Map();

  addSubscriber (subscriber: Object, callbackKey: string, liveCallback: Function,
      immediateUpdateState: ?any) {
    let callbacks = this._subscribers.get(subscriber);
    if (!callbacks) this._subscribers.set(subscriber, (callbacks = new Map()));
    callbacks.set(callbackKey, liveCallback);
    let finalizer;
    if (immediateUpdateState) {
      if ((this._valkOptions.state === immediateUpdateState) && (this._value !== undefined)) {
        liveCallback(this, this);
      } else {
        this._valkOptions.state = immediateUpdateState;
        finalizer = _finalizeAddSubscriber.bind(this);
      }
    }
    if (!this._fieldListeners) {
      this._registerListeners(finalizer);
    } else if (finalizer) {
      finalizer(undefined);
    }
    return this;
    function _finalizeAddSubscriber (explicitValue: any) {
      if (explicitValue !== undefined) this._value = explicitValue;
      if (this._fieldName || (this._liveKuery !== undefined)) {
        this._emitLiveUpdate(this);
      } else if (this._fieldFilter !== undefined) {
        const fieldIntros = this._emitter.getTypeIntro().getFields();
        for (const fieldName of Object.keys(fieldIntros)) {
          const fieldIntro = fieldIntros[fieldName];
          if (!fieldIntro.isGenerated
              && ((this._fieldFilter === true) || this._fieldFilter(fieldIntro))) {
            this._fieldName = fieldName;
            this._value = undefined;
            this._emitLiveUpdate(this);
          }
        }
        this._fieldName = undefined;
        this._value = undefined;
      } else throw new Error("Subscription.addSubscriber() called before initialize*()");
    }
  }

  _resolveValue (): ?any {
    if (this._fieldName !== undefined) return super._resolveValue();
    if (this._fieldFilter !== undefined) {
      throw new Error(
          "Cannot determine the value of a filter subscription as it has no value semantics");
    }
    try {
      return this._run(this._liveHead, this._liveKuery);
    } catch (error) {
      const connectingAndThenReresolve = tryConnectToMissingPartitionsAndThen(error, () => {
        this._valkOptions.state = this._emitter.engine.discourse.getState();
        return this._resolveValue();
      });
      if (connectingAndThenReresolve) return connectingAndThenReresolve;
      throw error;
    }
  }

  removeSubscriber (subscriber: Object, callbackKey: ?string) {
    const callbacks = this._subscribers.get(subscriber);
    if (!callbacks) return;
    callbacks.delete(callbackKey);
  }

  _registerListeners (onComplete: ?((explicitValue: ?any) => void)) {
    try {
      if (this._fieldListeners) throw new Error("Listeners already registered");
      this._fieldListeners = new Set();
      if (this._liveKuery !== undefined) {
        this._autoConnectingBuildLiveKuery(onComplete);
        return this;
      }
      if (this._fieldFilter !== undefined) {
        this._subscribeToFieldsByFilter(this._emitter, this._fieldFilter, false);
      } else if (this._fieldName !== undefined) {
        this._subscribeToFieldByName(this._emitter, this._fieldName, false);
      } else throw new Error("Subscription is uninitialized, cannot determine listeners");
      if (onComplete) onComplete();
      return this;
    } catch (error) {
      if (this._fieldListeners) this._unregisterListeners();
      const wrappedError = wrapError(error,
          new Error(`During ${this.debugId()}\n ._registerListeners(), with:`),
          "\n\temitter:", this._emitter,
          ...(this._liveKuery === undefined ? [
            "\n\tfilter:", this._fieldFilter || this._fieldName,
          ] : [
            "\n\thead:", ...dumpObject(this._liveHead),
            "\n\tkuery:", ...dumpKuery(this._liveKuery),
            "\n\toptions:", ...dumpObject(this._valkOptions),
          ]),
          "\n\tsubscription:", ...dumpObject(this));
      if (!this._valkOptions.sourceInfo) throw wrappedError;
      throw addStackFrameToError(wrappedError, this._liveKuery, this._valkOptions.sourceInfo);
    }
  }

  _unregisterListeners () {
    for (const listenerContainer of this._fieldListeners) { listenerContainer.delete(this); }
    this._fieldListeners = null;
  }

  triggerLiveUpdatesByFilterUpdate (fieldUpdate: FieldUpdate, fieldIntro: Object,
      handlerData: any, passageCounter: number) {
    if (this._fieldFilter) {
      if ((typeof this._fieldFilter === "function") && !this._fieldFilter(fieldIntro)) return;
    } else if (this._fieldName && (this._fieldName !== fieldIntro.name)) return;
    this.triggerLiveUpdatesByFieldUpdate(fieldUpdate, handlerData, passageCounter);
  }

  triggerLiveUpdatesByFieldUpdate (fieldUpdate: FieldUpdate, handlerData: any,
      passageCounter: number) {
    /*
    console.log(`got update to field '${fieldUpdate.getEmitter().debugId()}.${
        fieldUpdate.fieldName()}'`, ", new value:", ...dumpObject(fieldUpdate.value()));
    // */
    if (this._seenPassageCounter >= passageCounter) return;
    this._seenPassageCounter = passageCounter;
    if (this._liveKuery === undefined) {
      this._emitLiveUpdate(fieldUpdate);
      return;
    }
    const newState = fieldUpdate.getState();
    if (this._valkOptions.state === newState) return;
    this._valkOptions.state = newState;
    this._value = undefined;
    if (handlerData === false) {
      // TODO(iridian, 2019-03): Some of the field handlers are now
      // properly marked as non-structural using handlerData === false.
      // Fill the rest too.
      this._emitLiveUpdate(this);
      return;
    }
    // TODO(iridian): PERFORMANCE CONCERN: Refreshing the kuery
    // registrations on every update is quite costly. Especially so if
    // the kuery has property traversals: the current inefficient live
    // kuery implementation adds subscribers to all _candidate_
    // properties... so that's a lot of re-registered subscribers.
    // There are a bunch of algorithmic optimizations that can be done
    // to improve it. Alas, none of them are both trivial and
    // comprehensive to warrant doing before the cost becomes an actual
    // problem.
    this._unregisterListeners();
    this._registerListeners(value => {
      if ((this._valkOptions.state !== newState) || (this._value !== undefined)) return;
      this._value = value;
      this._emitLiveUpdate(this);
    });
  }

  _emitLiveUpdate (liveUpdate: LiveUpdate) {
    const wrap = new Error("_emitLiveUpdate");
    thenChainEagerly(undefined, [
      () => liveUpdate.value(),
      (value) => {
        liveUpdate._value = value;
        for (const [subscriber, callbacks] of this._subscribers) {
          for (const [callbackKey, liveCallback] of callbacks) {
            if (liveCallback(liveUpdate, this) === false) callbacks.delete(callbackKey);
          }
          if (!callbacks.size) this._subscribers.delete(subscriber);
        }
        if (!this._subscribers.size) this._unregisterListeners();
      },
    ], function errorOnEmitLiveUpdate (error) {
      throw wrapError(error, wrap,
          "\n\temitter:", liveUpdate.getEmitter(),
          `\n\tfilter ${this._liveKuery ? "kuery"
              : this._fieldFilter ? "filter"
              : "fieldName"}:`, this._liveKuery || this._fieldFilter || this._fieldName,
          "\n\tliveUpdate:", liveUpdate,
          "\n\tliveUpdate._value:", ...dumpObject(liveUpdate._value),
          "\n\tliveUpdate.state:", ...dumpObject(liveUpdate.getState().toJS()),
          "\n\tthis:", this);
    }.bind(this));
  }

  // Live builtinSteppers section

  _autoConnectingBuildLiveKuery (onComplete: ?((value: any) => void)) {
    const options: any = this._valkOptions;
    const verbosity = options.verbosity;
    let ret;
    let scope;
    try {
      if (verbosity) {
        options.verbosity = (verbosity > 2) ? verbosity - 2 : undefined;
        console.log(" ".repeat(options.verbosity),
            `Subscription(${this.debugId()})._autoConnectingBuildLiveKuery (verbosity: ${
                options.verbosity}) ${
                (typeof onComplete !== "undefined") ? "evaluating" : "processing"} step with:`,
            "\n", " ".repeat(options.verbosity), "head:", ...dumpObject(this._liveHead),
            "\n", " ".repeat(options.verbosity), "kuery:", ...dumpKuery(this._liveKuery),
        );
      }
      scope = this._valkOptions.scope ? Object.create(this._valkOptions.scope) : {};
      const packedValue = this._buildLiveKuery(
          this._liveHead, this._liveKuery, scope, onComplete !== undefined);
      if (onComplete) {
        ret = this._emitter.engine.discourse.unpack(packedValue);
        onComplete(ret);
      }
    } catch (error) {
      this._unregisterListeners();
      if (tryConnectToMissingPartitionsAndThen(error, () => {
        options.state = this._emitter.engine.discourse.getState();
        this._registerListeners(onComplete);
      })) return;
      throw wrapError(error, `During ${this.debugId()}\n ._autoConnectingBuildLiveKuery(), with:`,
          "\n\thead:", ...dumpObject(this._liveHead),
          "\n\tkuery:", ...dumpKuery(this._liveKuery),
          "\n\tscope:", ...dumpObject(scope),
          "\n\toptions.state:", ...dumpObject(options.state && options.state.toJS()),
      );
    } finally {
      if (verbosity) {
        console.log(" ".repeat(options.verbosity),
            `Subscription(${this.debugId()})._autoConnectingBuildLiveKuery result:`,
            ...dumpObject(ret));
        options.verbosity = verbosity;
      }
    }
  }

  _buildLiveKuery (rawHead: any, kuery: any, scope: any, evaluateKuery: ?boolean) {
    // Processing a Kuery for live updates involves walking the kuery tree for all field steps
    // which have a Vrapper as a head and subscribing to those. Effectively this means that only
    // non-final path steps need to be evaluated.
    const head = (rawHead instanceof VRL)
        ? this._emitter.engine.getVrapper(rawHead) : rawHead;
    let kueryVAKON = kuery instanceof Kuery ? kuery.toVAKON() : kuery;
    let ret: any;
    if (this._valkOptions.verbosity) {
      console.log(" ".repeat(this._valkOptions.verbosity),
          `Subscription(${this.debugId()}) ${
              evaluateKuery ? "evaluating" : "processing"} step with:`,
          "\n", " ".repeat(this._valkOptions.verbosity), "head:", ...dumpObject(head),
          "\n", " ".repeat(this._valkOptions.verbosity), "kuery:", ...dumpKuery(kuery)
      );
      this._valkOptions.verbosity += 2;
    }
    try {
      switch (typeof kueryVAKON) {
        case "boolean": return (ret = head);
        case "function": break;  // Builtin function call just uses default .run below.
        case "string":
        case "symbol":
        case "number":
          if (typeof head !== "object") {
            invariantifyObject(head,
                "Subscription._buildLiveKuery.head (with string or number kuery)");
          }
          if (!(head instanceof Vrapper)) {
            return (ret = ((evaluateKuery === true) && head[kueryVAKON]));
          }
          this._subscribeToFieldByName(head, kueryVAKON, evaluateKuery);
          break;
        case "object": {
          if (kueryVAKON === null) return (ret = head);
          if (!Array.isArray(kueryVAKON)) {
            // Select.
            if (Object.getPrototypeOf(kueryVAKON) !== Object.prototype) {
              throw new Error(
                  "Invalid kuery VAKON object: only plain data objects and arrays are valid");
            }
            ret = (evaluateKuery === true) ? {} : undefined;
            for (const key of Object.keys(kueryVAKON)) {
              let value = kueryVAKON[key];
              if ((typeof value === "object") && (value !== null)) {
                value = this._buildLiveKuery(head, kueryVAKON[key], scope, evaluateKuery);
              }
              if (evaluateKuery === true) ret[key] = value;
            }
            return ret;
          }
          let opName = kueryVAKON[0];
          if (opName === "§->") {
            // Path op.
            const pathScope = Object.create(scope);
            let stepIndex = 1;
            let stepHead = head;
            while (stepIndex < kueryVAKON.length) {
              const step = kueryVAKON[stepIndex];
              stepIndex += 1;
              if (step === false && (stepHead == null)) break;
              stepHead = this._buildLiveKuery(stepHead, step, pathScope,
                  (stepIndex < kueryVAKON.length) || evaluateKuery);
            }
            return (ret = stepHead);
          }
          if ((typeof opName !== "string") || (opName[0] !== "§")) {
            // Array op.
            kueryVAKON = [(opName = "§[]"), ...kueryVAKON];
          }
          // Builtin.
          let handler = customLiveExpressionOpHandlers[opName];
          if (handler) {
            ret = handler(this, head, kueryVAKON, scope, evaluateKuery);
            if (ret === performFullDefaultProcess) handler = undefined;
            else if (ret !== performDefaultGet) return ret;
          }
          if (handler === undefined) {
            for (let i = 1; i < kueryVAKON.length; ++i) {
              const argument = kueryVAKON[i];
              // Skip non-object, non-path builtin args as they are treated as literals.
              if ((typeof argument === "object") && (argument !== null)) {
                this._buildLiveKuery(head, argument, scope, evaluateKuery);
              }
            }
          }
          break;
        }
        default:
      }
      return (ret = (evaluateKuery !== true)
          ? undefined
      // TODO(iridian): The non-pure kueries should be replaced with pure kueries?
          : this._run(head, kueryVAKON, scope));
    } catch (error) {
      throw this._addStackFrameToError(
          wrapError(error, `During ${this.debugId()}\n .processKuery(), with:`,
              "\n\thead:", head,
              "\n\tkuery VAKON:", ...dumpKuery(kueryVAKON),
              "\n\tscope:", ...dumpObject(scope)),
          kueryVAKON);
    } finally {
      if (this._valkOptions.verbosity) {
        console.log(" ".repeat(this._valkOptions.verbosity),
            `Subscription(${this.debugId()}) result:`, ...dumpObject(ret));
        this._valkOptions.verbosity -= 2;
      }
    }
  }

  _processLiteral (head: any, vakon: any, scope: any, evaluateKuery: ?boolean) {
    if (typeof vakon !== "object") return vakon;
    if (vakon === null) return head;
    if (vakon[0] === "§'") return vakon[1];
    return this._buildLiveKuery(head, vakon, scope, evaluateKuery);
  }

  _subscribeToFieldByName (emitter: Vrapper, fieldName: string | Symbol, isStructural: ?boolean) {
    /*
    console.log(`Subscription._subscribeToFieldByName(${emitter.debugId()}.${fieldName})`);
    // */
    const container = emitter._addFieldHandler(fieldName, this, isStructural);
    if (container) this._fieldListeners.add(container);
  }

  _subscribeToFieldsByFilter (emitter: Vrapper, fieldFilter: Function | boolean,
      isStructural: ?boolean) {
    /*
    console.log(`Subscription(_subscribeToFieldByName(${emitter.debugId()}.${
        fieldFilter.constructor.name})`);
    // */
    const container = emitter._addFilterSubscription(fieldFilter, this, isStructural);
    if (container) this._fieldListeners.add(container);
  }

  _run (head: any, kuery: any, scope?: any) {
    let options = this._valkOptions;
    if (scope !== undefined) {
      options = Object.create(options);
      options.scope = scope;
    }
    if (options.state === undefined) throw new Error("Subscription.state is undefined");
    return this._emitter.engine.discourse.run(head, kuery, options);
  }

  _addStackFrameToError (error: Error, sourceVAKON: any) {
    return addStackFrameToError(error, sourceVAKON, this._valkOptions.sourceInfo);
  }
}

const performDefaultGet = {};
const performFullDefaultProcess = {};

function throwUnimplementedLiveKueryError (subscription, head, kueryVAKON) {
  throw new Error(`Live kuery not implemented yet for complex step: ${
      JSON.stringify(kueryVAKON)}`);
}

function throwMutationLiveKueryError (subscription, head, kueryVAKON) {
  throw new Error(`Cannot make a kuery with side-effects live. Offending step: ${
      JSON.stringify(kueryVAKON)}`);
}

// undefined: use default behaviour ie. walk all arguments
// null: completely disabled
// other: call corresponding function callback, if it returns performDefaultGet then use default,
//        otherwise return the value directly.
const customLiveExpressionOpHandlers = {
  "§'": null,
  "§vrl": null,
  "§ref": null,
  "§$": undefined,
  "§map": liveMap,
  "§filter": liveFilter,
  "§method": undefined,
  "§@": undefined,
  "§?": liveTernary,
  "§//": null,
  "§[]": undefined,
  "§{}": function liveFieldSet (subscription: Subscription, head: any, kueryVAKON: Array<any>,
      scope: any) {
    return liveFieldOrScopeSet(subscription, head, kueryVAKON, scope, {});
  },
  // Allow immediate object live mutations; parameter object computed properties use this.
  "§.<-": function liveFieldSet (subscription: Subscription, head: any, kueryVAKON: Array<any>,
      scope: any) {
    return liveFieldOrScopeSet(subscription, head, kueryVAKON, scope, head);
  },
  // Allow immediate scope live mutations; they have valid uses as intermediate values.
  "§$<-": function liveScopeSet (subscription: Subscription, head: any, kueryVAKON: Array<any>,
      scope: any) {
    return liveFieldOrScopeSet(subscription, head, kueryVAKON, scope, scope);
  },
  "§expression": undefined,
  "§literal": undefined,
  "§evalk": liveEvalk,
  "§capture": undefined, // Note: captured function _contents_ are not live-hooked against
  "§apply": liveApply,
  "§call": liveCall,
  "§invoke": liveInvoke,
  "§new": throwMutationLiveKueryError,
  "§regexp": undefined,
  "§void": undefined,
  "§throw": null,
  "§typeof": liveTypeof,
  "§in": undefined,
  "§instanceof": undefined,
  "§while": throwUnimplementedLiveKueryError,
  "§!": undefined,
  "§!!": undefined,
  "§&&": liveAnd,
  "§||": liveOr,
  "§==": undefined,
  "§!=": undefined,
  "§===": undefined,
  "§!==": undefined,
  "§<": undefined,
  "§<=": undefined,
  "§>": undefined,
  "§>=": undefined,
  "§+": undefined,
  "§-": undefined,
  "§negate": undefined,
  "§*": undefined,
  "§/": undefined,
  "§%": undefined,
  "§**": undefined,
  "§&": undefined,
  "§|": undefined,
  "§^": undefined,
  "§~": undefined,
  "§<<": undefined,
  "§>>": undefined,
  "§>>>": undefined,

  "§let$$": undefined,
  "§const$$": undefined,
  "§$$": function liveIdentifier (subscription: Subscription, head: any, kueryVAKON: any,
      scope: any, evaluateKuery: boolean) {
    return liveMember(subscription, head, kueryVAKON, scope, evaluateKuery, false);
  },
  "§..": function liveProperty (subscription: Subscription, head: any, kueryVAKON: any,
      scope: any, evaluateKuery: boolean) {
    return liveMember(subscription, head, kueryVAKON, scope, evaluateKuery, true);
  },
  "§$$<-": throwMutationLiveKueryError,
  "§..<-": throwMutationLiveKueryError,
  "§delete$$": throwMutationLiveKueryError,
  "§delete..": throwMutationLiveKueryError,
/*  {
        // Live expression support not perfectly implemented yet: now subscribing to all fields of
        // a singular head preceding an expression. Considerable number of use cases work even
        // without it: most of filters, finds and conditionals are covered by this.
        // Extending support for live list filtering use cases, ie. when the head is an array,
        // should be enabled only when needed and profiled.
        // Expressions which go deeper than that will be incorrectly not live.
        subscribers.push(head.obtainSubscription(true)
            .addSubscriber({}, "test", () => this.forceUpdate()));
      }
*/
};

function liveMap (subscription: Subscription, head: any, kueryVAKON: Array<any>, scope: any,
    evaluateKuery: boolean) {
  if (!Array.isArray(head)) return undefined;
  const opVAKON = ["§->", ...kueryVAKON.slice(1)];
  const ret = evaluateKuery ? [] : undefined;
  for (const entry of head) {
    const result = subscription._buildLiveKuery(entry, opVAKON, scope, evaluateKuery);
    ret.push(result);
  }
  return ret;
}

function liveFilter (subscription: Subscription, head: any, kueryVAKON: Array<any>, scope: any,
    evaluateKuery: boolean) {
  if (!Array.isArray(head)) return undefined;
  const opVAKON = ["§->", ...kueryVAKON.slice(1)];
  const ret = evaluateKuery ? [] : undefined;
  for (const entry of head) {
    const result = subscription._buildLiveKuery(entry, opVAKON, scope, evaluateKuery);
    if (result) ret.push(entry);
  }
  return ret;
}

function liveTernary (subscription: Subscription, head: any, kueryVAKON: Array<any>, scope: any,
    evaluateKuery: boolean) {
  const conditionVAKON = kueryVAKON[1];
  const condition = subscription._buildLiveKuery(head, conditionVAKON, scope, true);
  const clauseTakenVAKON = condition ? kueryVAKON[2] : kueryVAKON[3];
  return subscription._processLiteral(head, clauseTakenVAKON, scope, evaluateKuery);
}

function liveAnd (subscription: Subscription, head: any, kueryVAKON: Array<any>, scope: any/* ,
    evaluateKuery: boolean */) {
  let value;
  for (let index = 1; index < kueryVAKON.length; ++index) {
    value = subscription._processLiteral(head, kueryVAKON[index], scope, true);
    if (!value) return value;
  }
  return value;
}

function liveOr (subscription: Subscription, head: any, kueryVAKON: Array<any>, scope: any/* ,
    evaluateKuery: boolean */) {
  let value;
  for (let index = 1; index < kueryVAKON.length; ++index) {
    value = subscription._processLiteral(head, kueryVAKON[index], scope, true);
    if (value) return value;
  }
  return value;
}

function liveFieldOrScopeSet (subscription: Subscription, head: any, kueryVAKON: Array<any>,
    scope: any, target: any) {
  for (let index = 0; index + 1 !== kueryVAKON.length; ++index) {
    const setter = kueryVAKON[index + 1];
    if ((typeof setter !== "object") || (setter === null)) continue;
    if (Array.isArray(setter)) {
      const name = (typeof setter[0] !== "object") || (setter[0] === null)
          ? setter[0]
          : subscription._processLiteral(head, setter[0], scope, true);
      const value = (typeof setter[1] !== "object") || (setter[1] === null)
          ? setter[1]
          : subscription._processLiteral(head, setter[1], scope, true);
      target[name] = value;
    } else {
      for (const key of Object.keys(setter)) {
        const value = setter[key];
        target[key] = (typeof value !== "object") || (value === null)
            ? value
            : subscription._processLiteral(head, value, scope, true);
      }
    }
  }
  return target;
}

function liveEvalk (subscription: Subscription, head: any, kueryVAKON: Array<any>, scope: any,
    evaluateKuery: boolean) {
  const evaluateeVAKON = typeof kueryVAKON[1] !== "object" ? kueryVAKON[1]
      : subscription._buildLiveKuery(head, kueryVAKON[1], scope, true);
  return subscription._buildLiveKuery(head, evaluateeVAKON, scope, evaluateKuery);
}

function liveApply (subscription: Subscription, head: any, kueryVAKON: Array<any>, scope: any,
    evaluateKuery: boolean) {
  let eCallee = subscription._processLiteral(head, kueryVAKON[1], scope, true);
  if (typeof eCallee !== "function") {
    eCallee = subscription._emitter.engine.discourse
        .advance(eCallee, ["§callableof", null, "liveApply"], scope);
    invariantify(typeof eCallee === "function",
        `trying to call a non-function value of type '${typeof eCallee}'`,
        "\n\tfunction wannabe value:", eCallee);
  }
  let eThis = (typeof kueryVAKON[2] === "undefined")
      ? scope
      : subscription._processLiteral(head, kueryVAKON[2], scope, true);
  const eArgs = subscription._processLiteral(head, kueryVAKON[3], scope, true);
  if (!eCallee._valkCreateKuery) return performDefaultGet;
  // TODO(iridian): Fix this kludge which enables namespace proxies
  eThis = eThis[UnpackedHostValue] || eThis;
  return subscription._buildLiveKuery(
      eThis, eCallee._valkCreateKuery(...eArgs), scope, evaluateKuery);
}

function liveCall (subscription: Subscription, head: any, kueryVAKON: Array<any>, scope: any,
    evaluateKuery: boolean) {
  let eCallee = subscription._processLiteral(head, kueryVAKON[1], scope, true);
  if (typeof eCallee !== "function") {
    eCallee = subscription._emitter.engine.discourse
        .advance(eCallee, ["§callableof", null, "liveCall"], scope);
    invariantify(typeof eCallee === "function",
        `trying to call a non-function value of type '${typeof eCallee}'`,
        `\n\tfunction wannabe value:`, eCallee);
  }
  let eThis = (typeof kueryVAKON[2] === "undefined")
      ? scope
      : subscription._processLiteral(head, kueryVAKON[2], scope, true);
  const eArgs = [];
  for (let i = 3; i < kueryVAKON.length; ++i) {
    eArgs.push(subscription._processLiteral(head, kueryVAKON[i], scope, true));
  }
  if (!eCallee._valkCreateKuery) return performDefaultGet;
  // TODO(iridian): Fix this kludge which enables namespace proxies
  eThis = eThis[UnpackedHostValue] || eThis;
  return subscription._buildLiveKuery(
      eThis, eCallee._valkCreateKuery(...eArgs), scope, evaluateKuery);
}

function liveInvoke (subscription: Subscription, head: any, kueryVAKON: Array<any>, scope: any,
    evaluateKuery: boolean) {
  let eCallee = subscription._processLiteral(head, ["§..", kueryVAKON[1]], scope, true);
  if (typeof eCallee !== "function") {
    eCallee = subscription._emitter.engine.discourse
        .advance(eCallee, ["§callableof", null, "liveCall"], scope);
    invariantify(typeof eCallee === "function",
        `trying to call a non-function value of type '${typeof eCallee}'`,
        `\n\tfunction wannabe value:`, eCallee);
  }
  const eArgs = [];
  for (let i = 2; i < kueryVAKON.length; ++i) {
    eArgs.push(subscription._processLiteral(head, kueryVAKON[i], scope, true));
  }
  if (!eCallee._valkCreateKuery) return performDefaultGet;
  return subscription._buildLiveKuery(
      head, eCallee._valkCreateKuery(...eArgs), scope, evaluateKuery);
}

function liveTypeof (subscription: Subscription, head: any, kueryVAKON: Array<any>) {
  const objectVAKON = kueryVAKON[1];
  return (Array.isArray(objectVAKON) && (objectVAKON[0] === "§$$")
          && (typeof objectVAKON[1] === "string"))
      ? performDefaultGet
      : performFullDefaultProcess;
}

const toProperty = {};

function liveMember (subscription: Subscription, head: any, kueryVAKON: Array<any>,
    scope: any, evaluateKuery: boolean, isProperty: boolean) {
  const containerVAKON = kueryVAKON[2];
  let container;
  let propertyName;
  let vProperty;
  try {
    container = (typeof containerVAKON === "undefined")
        ? (isProperty ? head : scope)
        : subscription._run(head, containerVAKON, scope);

    propertyName = kueryVAKON[1];
    if ((typeof propertyName !== "string") && !isSymbol(propertyName)
        && (typeof propertyName !== "number")) {
      propertyName = subscription._buildLiveKuery(head, propertyName, scope, true);
      if ((typeof propertyName !== "string") && !isSymbol(propertyName)
          && (!isProperty || (typeof propertyName !== "number"))) {
        if (propertyName === null) return undefined;
        throw new Error(`Cannot use a value with type '${typeof propertyName}' as ${
                isProperty ? "property" : "identifier"} name`);
      }
    }

    if ((typeof container !== "object") || (container === null)) {
      return evaluateKuery ? container[propertyName] : undefined;
    }
    if (container[HostRef] === undefined) {
      const property = container[propertyName];
      if ((typeof property !== "object") || (property === null)) {
        if (!isProperty && (typeof property === "undefined") && !(propertyName in container)) {
          throw new Error(`Cannot find identifier '${propertyName}' in scope`);
        }
        return property;
      }
      if (isNativeIdentifier(property)) return getNativeIdentifierValue(property);
      if (!(property instanceof Vrapper) || (property.tryTypeName() !== "Property")) {
        return property;
      }
      vProperty = property;
    } else if (container._lexicalScope && container._lexicalScope.hasOwnProperty(propertyName)) {
      vProperty = container._lexicalScope[propertyName];
    } else {
      let vrapper = container[UnpackedHostValue];
      if (vrapper === undefined) {
        throw new Error("Invalid container: expected one with valid UnpackedHostValue");
      }
      let propertyKey;
      if (vrapper === null) { // container itself is the Vrapper.
        vrapper = container;
        propertyKey = propertyName;
      } else { // container is a namespace proxy
        propertyKey = container[propertyName];
      }
      const descriptor = vrapper.engine.getHostObjectPrototype(
          vrapper.getTypeName(subscription._valkOptions))[propertyKey];
      if (descriptor) {
        if (!descriptor.writable || !descriptor.kuery) return performDefaultGet;
        return subscription._buildLiveKuery(vrapper, descriptor.kuery, scope, true);
      }
      vProperty = subscription._run(container,
          toProperty[propertyName]
              || (toProperty[propertyName] = VALEK.property(propertyName).toVAKON()),
          scope);
      if (!vProperty && isProperty) {
        subscription._buildLiveKuery(container, "properties", scope);
        return undefined;
      }
    }
    if (!vProperty && !isProperty) {
      throw new Error(`Cannot find identifier '${String(propertyName)}' in scope`);
    }
    subscription._subscribeToFieldsByFilter(vProperty, true, evaluateKuery);
    const value = subscription._run(vProperty, "value", scope);
    if (value) {
      switch (value.typeName) {
        case "Literal":
          return value.value;
        case "Identifier":
          return evaluateKuery ? performDefaultGet : undefined;
        case "KueryExpression":
          return subscription._buildLiveKuery(container, value.vakon, scope, true);
        default:
          throw new Error(`Unrecognized Property.value.typeName '${value.typeName}' in live kuery`);
      }
    }
    return undefined;
  } catch (error) {
    throw wrapError(error, new Error(`During ${subscription.debugId()}\n .liveMember(), with:`),
        "\n\tcontainer:", ...dumpObject(container),
        "\n\tpropertyName:", ...dumpObject(propertyName),
        "\n\tvProperty:", ...dumpObject(vProperty));
  }
}
