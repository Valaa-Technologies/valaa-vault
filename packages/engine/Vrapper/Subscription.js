// @flow

import type { VALKOptions } from "~/raem/VALK";
import { HostRef, UnpackedHostValue } from "~/raem/VALK/hostReference";
import { addStackFrameToError, SourceInfoTag } from "~/raem/VALK/StackTrace";

import ValaaReference from "~/raem/ValaaReference";
import { tryConnectToMissingPartitionsAndThen } from "~/raem/tools/denormalized/partitions";

import { isNativeIdentifier, getNativeIdentifierValue } from "~/script";

import Cog from "~/engine/Cog";
import Vrapper from "~/engine/Vrapper";
import VALEK, { Kuery, dumpKuery, dumpObject } from "~/engine/VALEK";
import FieldUpdate from "~/engine/Vrapper/FieldUpdate";

import SimpleData from "~/tools/SimpleData";

import { invariantify, invariantifyObject, isSymbol, thenChainEagerly, wrapError } from "~/tools";

export default class Subscription extends SimpleData {
  callback: Function;
  _emitter: Cog;

  _subscribedKuery: ?Kuery;
  _subscribedHead: ?any;
  _subscribedFieldName: ?string | ?Symbol;
  _subscribedFieldFilter: ?Function | ?boolean;

  _subscriberContainers: Object;
  _valkOptions: VALKOptions;

  subscriberKey: string;
  subscriber: Object;

  debugId (options: ?Object): string {
    return `${this.constructor.name}(${this.subscriberKey}: ${
        this._emitter && this._emitter.debugId(options)})`;
  }

  initializeFilter (emitter: Cog, filter: boolean | string | Function, callback: Function) {
    this.callback = callback;
    this._emitter = emitter;
    this._subscriberContainers = new Set();
    if (!this.subscriberKey) this.subscriberKey = "unknown";
    try {
      if ((typeof filter === "string") || isSymbol(filter)) {
        this._subscribedFieldName = filter;
        this._subscribeToFieldByName(emitter, filter, false);
      } else if ((typeof filter === "boolean") || (typeof filter === "function")) {
        this._subscribedFieldFilter = filter;
        this._subscribeToFieldsByFilter(emitter, filter, false);
      } else throw new Error("Unrecognized initializeFilter.filter");
      return this;
    } catch (error) {
      this.unregister();
      throw wrapError(error, `During ${this.debugId()}\n .initializeFilter(), with:`,
          "\n\temitter:", emitter,
          "\n\tfilter:", filter,
          "\n\tcallback:", callback,
          "\n\tsubscription:", this);
    }
  }

  initializeKuery (emitter: Cog, head: any, kuery: Kuery, callback: Function,
      options: VALKOptions, shouldTriggerUpdate: boolean) {
    this.callback = callback;
    this._emitter = emitter;
    this._subscriberContainers = new Set();
    if (!this.subscriberKey) this.subscriberKey = "unknown";
    try {
      this._subscribedHead = head;
      this._subscribedKuery = kuery;
      this._valkOptions = options;
      this._valkOptions.noSideEffects = true; // TODO(iridian): Implement this in Valker.
      if (kuery instanceof Kuery) {
        this._subscribedKuery = kuery.toVAKON();
        this._valkOptions.sourceInfo = kuery[SourceInfoTag];
      }
      delete this._valkOptions.onUpdate;
      this._retryProcessKuery(shouldTriggerUpdate
          && ((value) => this.triggerUpdate(this._valkOptions, value)));
      return this;
    } catch (error) {
      this.unregister();
      const wrappedError = wrapError(error, `During ${this.debugId()}\n .initializeKuery(), with:`,
              "\n\temitter:", ...dumpObject(emitter),
              "\n\thead:", ...dumpObject(head),
              "\n\tkuery:", ...dumpKuery(kuery),
              "\n\toptions:", ...dumpObject(options));
      if (!(kuery instanceof Kuery)) throw wrappedError;
      throw addStackFrameToError(wrappedError, kuery.toVAKON(), kuery[SourceInfoTag]);
    }
  }

  registerWithSubscriberInfo (subscriberKey: string, subscriber: Object) {
    this.subscriberKey = subscriberKey;
    this.subscriber = subscriber;
    return this;
  }


  /**
   * triggers an immediate emit.
   * Does not update live kuery structure.
   *
   * @param { valkOptions?: VALKOptions } [options={}]
   * @returns
   *
   * @memberof Subscription
   */
  triggerUpdate (valkOptions: VALKOptions, explicitValue?: any) {
    const update = new FieldUpdate(
        this._emitter,
        this._subscribedFieldFilter
            ? undefined
            : (this._subscribedFieldName || this._subscribedKuery),
        undefined,
        this._valkOptions || valkOptions,
        explicitValue);
    try {
      if (this._subscribedFieldName) {
        this._sendUpdate(update);
      } else if (typeof this._subscribedKuery !== "undefined") {
        this._triggerKueryUpdate(update, valkOptions);
      } else if (this._subscribedFieldFilter) {
        const fieldIntros = this._emitter.getTypeIntro().getFields();
        for (const fieldName of Object.keys(fieldIntros)) {
          const fieldIntro = fieldIntros[fieldName];
          if (!fieldIntro.isGenerated
              && ((this._subscribedFieldFilter === true)
                  || this._subscribedFieldFilter(fieldIntro))) {
            update._fieldName = fieldName;
            delete update._value;
            this._sendUpdate(update);
          }
        }
      } else throw new Error("Subscription.triggerUpdate() called before initialize*()");
      return this;
    } catch (error) {
      throw wrapError(error, `During ${this.debugId(valkOptions)}\n .triggerUpdate(), with:`,
          "\n\tvalkOptions:", valkOptions,
          "\n\tstate:", valkOptions && valkOptions.state && valkOptions.state.toJS(),
          "\n\tcurrent update:", update,
          "\n\tsubscription:", this);
    }
  }

  unregister () {
    for (const container of this._subscriberContainers) { container.delete(this); }
    this._subscriberContainers = new Set();
  }

  _triggerKueryUpdate (update: FieldUpdate) {
    const options: any = update.valkOptions();
    const verbosity = options.verbosity;
    options.state = (options && options.state)
        || this._emitter.engine.discourse.getState();
    if (verbosity) {
      options.verbosity = (verbosity > 2) ? verbosity - 2 : undefined;
      console.log(" ".repeat(options.verbosity),
          `Subscription(${this.subscriberKey})._triggerKueryUpdate (verbosity: ${
              options.verbosity}) valking with:`,
          "\n", " ".repeat(options.verbosity), "head:", ...dumpObject(this._subscribedHead),
          "\n", " ".repeat(options.verbosity), "kuery:",
              ...dumpKuery(this._subscribedKuery),
      );
    }
    try {
      if (!update.hasOwnProperty("_explicitValue")) {
        update._value = this._run(this._subscribedHead, this._subscribedKuery);
      }
      this._sendUpdate(update);
    } finally {
      if (verbosity) {
        console.log(" ".repeat(options.verbosity),
            `Subscription(${this.subscriberKey})._triggerKueryUpdate result:`,
            ...dumpObject(update.value()));
        options.verbosity = verbosity;
      }
    }
  }

  _retryProcessKuery (onComplete: ?any) {
    const options: any = this._valkOptions;
    const verbosity = options.verbosity;
    let ret;
    let scope;
    try {
      if (verbosity) {
        options.verbosity = (verbosity > 2) ? verbosity - 2 : undefined;
        console.log(" ".repeat(options.verbosity),
            `Subscription(${this.subscriberKey}).retryProcessKuery (verbosity: ${
                options.verbosity}) ${
                (typeof onComplete !== "undefined") ? "evaluating" : "processing"} step with:`,
            "\n", " ".repeat(options.verbosity), "head:", ...dumpObject(this._subscribedHead),
            "\n", " ".repeat(options.verbosity), "kuery:", ...dumpKuery(this._subscribedKuery),
        );
      }
      scope = this._valkScope() ? Object.create(this._valkScope()) : {};
      const packedValue = this._processKuery(this._subscribedHead, this._subscribedKuery,
          scope, (typeof onComplete !== "undefined"));
      if (onComplete) {
        ret = this._emitter.engine.discourse.unpack(packedValue);
        onComplete(ret);
      }
    } catch (error) {
      this.unregister();
      const isConnecting = tryConnectToMissingPartitionsAndThen(error, () => {
        options.state = this._emitter.engine.discourse.getState();
        this._retryProcessKuery(onComplete);
      });
      if (isConnecting) return;
      throw wrapError(error, `During ${this.debugId()}\n .retryProcessKuery(), with:`,
          "\n\thead:", ...dumpObject(this._subscribedHead),
          "\n\tkuery:", ...dumpKuery(this._subscribedKuery),
          "\n\tscope:", ...dumpObject(scope));
    } finally {
      if (verbosity) {
        console.log(" ".repeat(options.verbosity),
            `Subscription(${this.subscriberKey}).retryProcessKuery result:`,
            ...dumpObject(ret));
        options.verbosity = verbosity;
      }
    }
  }

  _processKuery (rawHead: any, kuery: any, scope: any, evaluateKuery: ?boolean) {
    // Processing a Kuery for live updates involves walking the kuery tree for all field steps
    // which have a Vrapper as a head and subscribing to those. Effectively this means that only
    // non-final path steps need to be evaluated.
    const head = (rawHead instanceof ValaaReference)
        ? this._emitter.engine.getVrapper(rawHead) : rawHead;
    let kueryVAKON = kuery instanceof Kuery ? kuery.toVAKON() : kuery;
    let ret: any;
    if (this._valkOptions.verbosity) {
      console.log(" ".repeat(this._valkOptions.verbosity),
          `Subscription(${this.subscriberKey}) ${
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
                "Subscription._processKuery.head (with string or number kuery)");
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
                value = this._processKuery(head, kueryVAKON[key], scope, evaluateKuery);
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
              stepHead = this._processKuery(stepHead, step, pathScope,
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
                this._processKuery(head, argument, scope, evaluateKuery);
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
            `Subscription(${this.subscriberKey}) result:`, ...dumpObject(ret));
        this._valkOptions.verbosity -= 2;
      }
    }
  }

  _processLiteral (head: any, vakon: any, scope: any, evaluateKuery: ?boolean) {
    if (typeof vakon !== "object") return vakon;
    if (vakon === null) return head;
    if (vakon[0] === "§'") return vakon[1];
    return this._processKuery(head, vakon, scope, evaluateKuery);
  }

  _subscribeToFieldByName (emitter: Vrapper, fieldName: string | Symbol
      /* , isStructural: ?boolean */) {
    /*
    console.log(`Subscription(${this.subscriberKey})\n ._subscribeToFieldByName ${
        emitter.debugId()}.${fieldName}`);
    // */
    const container = emitter._addFieldSubscription(fieldName, this);
    if (container) this._subscriberContainers.add(container);
  }

  _subscribeToFieldsByFilter (emitter: Vrapper, fieldFilter: Function | boolean/* ,
      isStructural: ?boolean */) {
    /*
    console.log(`Subscription(${this.subscriberKey})\n ._subscribeToFieldByName ${
        emitter.debugId()}.${fieldFilter.constructor.name}`);
    // */
    const container = emitter._addFilterSubscription(fieldFilter, this);
    if (container) this._subscriberContainers.add(container);
  }

  _tryTriggerUpdateByFieldUpdate (fieldIntro: Object, fieldUpdate: FieldUpdate) {
    if (this._subscribedFieldFilter && (typeof this._subscribedFieldFilter === "function")
        && !this._subscribedFieldFilter(fieldIntro)) return;
    if (this._subscribedFieldName && (this._subscribedFieldName !== fieldIntro.name)) return;
    this._triggerUpdateByFieldUpdate(fieldUpdate);
  }

  _triggerUpdateByFieldUpdate (fieldUpdate: FieldUpdate) {
    /*
    console.log(this.subscriberKey,
        `got update to field '${fieldUpdate.getEmitter().debugId()}.${fieldUpdate.fieldName()}'`,
        ", new value:", ...dumpObject(fieldUpdate.value()));
    // */
    const kuery = this._subscribedKuery;
    if (typeof kuery === "undefined") return this._sendUpdate(fieldUpdate);
    if (this._valkOptions.state === fieldUpdate.getState()) return undefined;
    this._valkOptions.state = fieldUpdate.getState();
    // TODO(iridian): PERFORMANCE CONCERN: Refreshing the kuery registrations on every update is
    // quite costly. Especially so if the kuery has property traversals: the current inefficient
    // live kuery implementation adds subscribers to all _candidate_ properties... so that's a lot
    // of re-registered subscribers.
    // There are a bunch of algorithmic optimizations that can be done to improve it. Alas, none
    // of them are both trivial and comprehensive to warrant doing before the cost becomes an
    // actual problem.
    this.unregister();
    this._retryProcessKuery(_value => {
      this._sendUpdate(fieldUpdate.fork({ _value }));
    });
    return undefined;
  }

  _run (head: any, kuery: any, scope?: any) {
    let options = this._valkOptions;
    if (typeof scope !== "undefined") {
      options = Object.create(options);
      options.scope = scope;
    }
    return this._emitter.engine.discourse.run(head, kuery, options);
  }

  _valkScope () { return this._valkOptions.scope; }

  _sendUpdate (fieldUpdate: FieldUpdate) {
    thenChainEagerly(undefined, [
      () => fieldUpdate.value(),
      (value) => {
        fieldUpdate._value = value;
        const ret = this.callback(fieldUpdate, this);
        if (ret === false) this.unregister();
      },
    ], onError.bind(this));
    function onError (error) {
      throw wrapError(error, `During ${this.debugId(fieldUpdate.valkOptions())
              }\n ._sendUpdate(), with:`,
          "\n\tsubscriber:", this.subscriber,
          "\n\temitter:", fieldUpdate.getEmitter(),
          "\n\tfieldUpdate:", fieldUpdate.getPassage(),
          `\n\tfilter ${this._subscribedFieldName ? "fieldName"
              : this._subscribedFieldFilter ? "filter"
              : "kuery"}:`,
              this._subscribedFieldName || this._subscribedFieldFilter || this._subscribedKuery,
          "\n\tfieldUpdate:", fieldUpdate,
          "\n\tthis:", this);
    }
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
        subscribers.push(head.subscribeToMODIFIED(true, () => this.forceUpdate()));
      }
*/
};

function liveMap (subscription: Subscription, head: any, kueryVAKON: Array<any>, scope: any,
    evaluateKuery: boolean) {
  if (!Array.isArray(head)) return undefined;
  const opVAKON = ["§->", ...kueryVAKON.slice(1)];
  const ret = evaluateKuery ? [] : undefined;
  for (const entry of head) {
    const result = subscription._processKuery(entry, opVAKON, scope, evaluateKuery);
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
    const result = subscription._processKuery(entry, opVAKON, scope, evaluateKuery);
    if (result) ret.push(entry);
  }
  return ret;
}

function liveTernary (subscription: Subscription, head: any, kueryVAKON: Array<any>, scope: any,
    evaluateKuery: boolean) {
  const conditionVAKON = kueryVAKON[1];
  const condition = subscription._processKuery(head, conditionVAKON, scope, true);
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
      : subscription._processKuery(head, kueryVAKON[1], scope, true);
  return subscription._processKuery(head, evaluateeVAKON, scope, evaluateKuery);
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
  return subscription._processKuery(
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
  return subscription._processKuery(
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
  return subscription._processKuery(head, eCallee._valkCreateKuery(...eArgs), scope, evaluateKuery);
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
      propertyName = subscription._processKuery(head, propertyName, scope, true);
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
        return subscription._processKuery(vrapper, descriptor.kuery, scope, true);
      }
      vProperty = subscription._run(container,
          toProperty[propertyName]
              || (toProperty[propertyName] = VALEK.property(propertyName).toVAKON()),
          scope);
      if (!vProperty && isProperty) {
        subscription._processKuery(container, "properties", scope);
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
          return subscription._processKuery(container, value.vakon, scope, true);
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