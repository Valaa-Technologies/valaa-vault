// @flow

import type { VALKOptions } from "~/raem/VALK";
import { addStackFrameToError, SourceInfoTag } from "~/raem/VALK/StackTrace";

import VRL from "~/raem/VRL";
import { tryConnectToMissingPartitionsAndThen } from "~/raem/tools/denormalized/partitions";

import liveKuerySteppers, { performDefaultGet, performFullDefaultProcess }
    from "~/engine/Vrapper/liveKuerySteppers";
import Vrapper from "~/engine/Vrapper";
import { Kuery, dumpKuery, dumpObject } from "~/engine/VALEK";
import FieldUpdate, { LiveUpdate } from "~/engine/Vrapper/FieldUpdate";

import { invariantifyObject, isSymbol, outputError, thenChainEagerly, wrapError } from "~/tools";

/**
 * Subscription is a shared object which represents a single live kuery
 * or field listeners. It has two main roles:
 * 1. a field handler registerer and a listener for specific field
 *    update notifications on Vrapper's
 * 2. subscriber tracker for top-level subscriber callback calls
 *
 * It also has two modes: immediate state mode and transactional mode.
 * Immediate mode is enabled if options.obtainSubscriptionTransaction
 * is not specified. In this mode the subscription value and subscriber
 * notifications are based on the internal getState() of this
 * subscription. refreshState will fetch the state from the currently
 * active top-level engine.discourse
 *
 * Otherwise transactional mode is enabled
 *
 * @export
 * @class Subscription
 * @extends {LiveUpdate}
 */
export default class Subscription extends LiveUpdate {
  // _valkOptions: VALKOptions;
  // _fieldName: string; // defined in LiveUpdate
  _liveHead: ?any;
  _liveKuery: ?Kuery;

  _fieldFilter: ?Function | ?boolean;

  _activeHookContainers: Object;

  constructor (emitter: Vrapper, liveOperation: any, options: ?VALKOptions, head: any) {
    super(emitter);
    this._valkOptions = options || {};
    if (options && options.obtainSubscriptionTransaction && (options.state !== undefined)) {
      throw new Error(
          "Subscription.options cannot contain both obtainSubscriptionTransaction and state");
    }
    if ((typeof liveOperation === "object") || (head !== undefined)) {
      // console.log("Kuery Sub created", emitter && emitter.debugId(), liveOperation);
      this._liveHead = (head !== undefined) ? head : emitter;
      this._liveKuery = liveOperation;
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

  debugId (options: ?Object): string {
    const name = this._liveKuery !== undefined ? "<kuery>" : this._fieldName || this._fieldFilter;
    return `${this.constructor.name}(${name}, ${this._emitter && this._emitter.debugId(options)})`;
  }

  _subscribers = new Map();

  addSubscriber (subscriber: Object, callbackKey: string, onUpdate: ?Function,
      immediateUpdate: ?any, asRepeathenable: ?boolean) {
    let callbacks = this._subscribers.get(subscriber);
    if (!callbacks) this._subscribers.set(subscriber, (callbacks = []));
    const subscription = this;
    if (onUpdate) then(onUpdate);
    return asRepeathenable && { then };
    function then (thenOnUpdate) {
      callbacks.push([callbackKey, thenOnUpdate]);
      if (!subscription._activeHookContainers) {
        subscription._activateHooks(immediateUpdate !== false);
      } else if (immediateUpdate !== false) {
        subscription._triggerOnUpdate(thenOnUpdate);
      }
    }
  }

  removeSubscriber (subscriber: Object, callbackKey: ?string) {
    const callbacks = this._subscribers.get(subscriber);
    if (!callbacks) return;
    let maxlen = callbacks.length;
    for (let i = 0; i !== maxlen; ++i) {
      if (callbacks[i][0] === callbackKey) callbacks[i--] = callbacks[--maxlen];
    }
    callbacks.length = maxlen;
    if (!callbacks.length) this._subscribers.delete(subscriber);
  }

  // Notify section

  triggerLiveUpdateByFilterHook (fieldUpdate: FieldUpdate, fieldIntro: Object, hookData: any,
      passageCounter: number) {
    if (this._fieldFilter) {
      if ((typeof this._fieldFilter === "function") && !this._fieldFilter(fieldIntro)) return;
    } else if (this._fieldName && (this._fieldName !== fieldIntro.name)) return;
    this.triggerLiveUpdateByFieldHook(fieldUpdate, hookData, passageCounter);
  }

  triggerLiveUpdateByFieldHook (fieldUpdate: FieldUpdate, hookData: any, passageCounter: number) {
    // console.log(`got update to field '${fieldUpdate.getEmitter().debugId()}.${
    //    fieldUpdate.fieldName()}'`, ", new value:", ...dumpObject(fieldUpdate.value()));
    if (this._seenPassageCounter >= passageCounter) return;
    this._seenPassageCounter = passageCounter;
    if (this._liveKuery === undefined) {
      this._broadcastUpdate(fieldUpdate);
      return;
    }
    if (!this._valkOptions.obtainSubscriptionTransaction) {
      const newState = fieldUpdate.getState();
      if (this._valkOptions.state === newState) return;
      this._valkOptions.state = newState;
    }
    this._value = undefined;
    if (hookData === false) {
      // TODO(iridian, 2019-03): Some of the field handlers are now
      // properly marked as non-structural with hookData === false.
      // Fill the rest too.
      this._broadcastUpdate(this);
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
    this._inactivateHooks();
    this._activateHooks(true);
  }

  _triggerOnUpdate (onUpdate = this._broadcastUpdate) {
    if (this._fieldFilter === undefined) {
      onUpdate(this, this);
      return;
    }
    const fieldIntros = this._emitter.getTypeIntro().getFields();
    for (const [fieldName, intro] of Object.entries(fieldIntros)) {
      if (!intro.isGenerated && ((this._fieldFilter === true) || this._fieldFilter(intro))) {
        this._fieldName = fieldName;
        this._value = undefined;
        onUpdate(this, this);
      }
    }
    this._fieldName = undefined;
    this._value = undefined;
  }

  _broadcastUpdate = (liveUpdate: LiveUpdate) => {
    thenChainEagerly(undefined, [
      () => liveUpdate.value(),
      (value) => {
        liveUpdate._value = value;
        for (const [subscriber, callbacks] of this._subscribers) {
          let maxlen = callbacks.length;
          for (let i = 0; i !== maxlen; ++i) {
            let keepCallback;
            try {
              keepCallback = callbacks[i][1](liveUpdate, this);
            } catch (error) {
              outputError(
                  errorOnEmitLiveUpdate.call(this, error, 1, subscriber, (callbacks[i] || [])[0]),
                  `Exception caught during emitLiveUpdate, removing subscriber callback`);
              keepCallback = false;
            }
            if (keepCallback === false) callbacks[i--] = callbacks[--maxlen];
          }
          callbacks.length = maxlen;
          if (!callbacks.length) this._subscribers.delete(subscriber);
        }
        if (!this._subscribers.size) this._inactivateHooks();
      },
    ], (error, stage) => { throw errorOnEmitLiveUpdate.call(this, error, stage); });
    function errorOnEmitLiveUpdate (error, stage, subscriber, callbackKey) {
      return wrapError(error, new Error(`_broadcastUpdate(stage #${stage})`),
          "\n\temitter:", liveUpdate.getEmitter(),
          `\n\tfilter ${this._liveKuery ? "kuery"
              : this._fieldFilter ? "filter"
              : "fieldName"}:`, this._liveKuery || this._fieldFilter || this._fieldName,
          "\n\tliveUpdate:", liveUpdate,
          "\n\tliveUpdate._value:", ...dumpObject(liveUpdate._value),
          "\n\tliveUpdate.state:", ...dumpObject(liveUpdate.getJSState()),
          ...(!subscriber ? [] : [
            "\n\tsubscriber:", ...dumpObject(subscriber),
            "\n\tcallbackKey:", callbackKey || "<missing callback>",
          ]),
          "\n\tthis subscription:", ...dumpObject(this));
    }
  }

  // Activation section

  _getDiscourse () {
    return this._valkOptions.transaction || this._emitter.engine.discourse;
  }

  _refreshState () {
    const options = this._valkOptions;
    if ((options.transaction === null)
        || (options.transaction && !options.transaction.isActiveTransaction())) {
      options.transaction = options.obtainSubscriptionTransaction
          ? options.obtainSubscriptionTransaction()
          : this._emitter.engine.discourse;
    }
    if (options.state === null) options.state = this._getDiscourse().getState();
  }

  _invalidateState () {
    if (this._valkOptions.state) this._valkOptions.state = null;
    if (this._valkOptions.transaction) this._valkOptions.transaction = null;
  }

  _resolveValue (): ?any {
    this._refreshState();
    if (this._fieldName !== undefined) return super._resolveValue();
    if (this._fieldFilter !== undefined) {
      throw new Error(
          "Cannot resolve the value of a filter subscription as it has no value semantics");
    }
    try {
      return this._getDiscourse().run(this._liveHead, this._liveKuery, this._valkOptions);
    } catch (error) {
      this._invalidateState();
      const connecting = tryConnectToMissingPartitionsAndThen(error, () => this._resolveValue());
      if (connecting) return connecting;
      throw error;
    } finally {
      if (this._valkOptions.transaction !== undefined) this._valkOptions.transaction = null;
    }
  }

  _activateHooks (triggerBroadcast: ?boolean) {
    try {
      if (this._activeHookContainers) throw new Error("Listeners already activated");
      this._activeHookContainers = new Set();
      if (triggerBroadcast !== false) {
        this._refreshState();
      }
      if (this._fieldFilter !== undefined) {
        this._subscribeToFieldsByFilter(this._emitter, this._fieldFilter, false);
      } else if (this._fieldName !== undefined) {
        this._subscribeToFieldByName(this._emitter, this._fieldName, false);
      } else if (this._liveKuery !== undefined) {
        this._activateLiveKueryHooks(triggerBroadcast !== false);
        return; // skip _triggerOnUpdate below
      } else throw new Error("Subscription is uninitialized, cannot determine listeners");
      if (triggerBroadcast !== false) {
        this._triggerOnUpdate();
      }
    } catch (error) {
      if (this._activeHookContainers) this._inactivateHooks();
      const wrappedError = wrapError(error,
          new Error(`During ${this.debugId()}\n ._activateHooks(${triggerBroadcast}), with:`),
          "\n\temitter:", this._emitter,
          ...(this._liveKuery === undefined ? [
            "\n\tfilter:", this._fieldFilter || this._fieldName,
            "\n\tstate:", ...dumpObject(this._valkOptions.state),
          ] : [
            "\n\thead:", ...dumpObject(this._liveHead),
            "\n\tkuery:", ...dumpKuery(this._liveKuery),
            "\n\toptions:", ...dumpObject(this._valkOptions),
          ]),
          "\n\tsubscription:", ...dumpObject(this));
      if (this._valkOptions.sourceInfo) {
        addStackFrameToError(wrappedError, this._liveKuery, this._valkOptions.sourceInfo);
      }
      throw wrappedError;
    }
  }

  _inactivateHooks () {
    for (const hookContainer of this._activeHookContainers) { hookContainer.delete(this); }
    this._activeHookContainers = null;
    this._invalidateState();
  }

  _subscribeToFieldByName (emitter: Vrapper, fieldName: string | Symbol, isStructural: ?boolean) {
    // console.log(`Subscription._subscribeToFieldByName(${emitter.debugId()}.${fieldName})`);
    const container = emitter._addFieldHook(fieldName, this, isStructural);
    if (container) this._activeHookContainers.add(container);
  }

  _subscribeToFieldsByFilter (emitter: Vrapper, filter: Function | boolean,
      isStructural: ?boolean) {
    // console.log(`Subscription(_subscribeToFieldByName(${emitter.debugId()}.${
    //    fieldFilter.constructor.name})`);
    const container = emitter._addFilterHook(filter, this, isStructural);
    if (container) this._activeHookContainers.add(container);
  }

  _activateLiveKueryHooks (triggerBroadcast: ?boolean) {
    const options: any = this._valkOptions;
    let scope;
    try {
      scope = this._valkOptions.scope ? Object.create(this._valkOptions.scope) : {};
      this._value = this._getDiscourse().run(this._liveHead, this._liveKuery,
          { ...options, scope, steppers: liveKuerySteppers, subscription: this });
      if (triggerBroadcast) {
        this._triggerOnUpdate();
      }
    } catch (error) {
      this._inactivateHooks();
      if (tryConnectToMissingPartitionsAndThen(error, () => {
        this._invalidateState();
        this._activateHooks(triggerBroadcast);
      })) return;
      throw wrapError(error, `During ${this.debugId()}\n ._activateLiveKueryHooks(), with:`,
          "\n\thead:", ...dumpObject(this._liveHead),
          "\n\tkuery:", ...dumpKuery(this._liveKuery),
          "\n\tscope:", ...dumpObject(scope),
          "\n\toptions.state:", ...dumpObject(options.state && options.state.toJS()),
      );
    } finally {
      if (options.transaction) options.transaction = null;
    }
  }
/*
  _activateLiveKueryHooksOld (triggerBroadcast: ?boolean) {
    const options: any = this._valkOptions;
    const verbosity = options.verbosity;
    let scope;
    try {
      if (verbosity) {
        options.verbosity = (verbosity > 2) ? verbosity - 2 : undefined;
        console.log(" ".repeat(options.verbosity),
            `Subscription(${this.debugId()})._activateLiveKueryHooks (verbosity: ${
                options.verbosity}) ${triggerBroadcast ? "evaluating" : "processing"} step with:`,
            "\n", " ".repeat(options.verbosity), "head:", ...dumpObject(this._liveHead),
            "\n", " ".repeat(options.verbosity), "kuery:", ...dumpKuery(this._liveKuery),
        );
      }
      scope = this._valkOptions.scope ? Object.create(this._valkOptions.scope) : {};
      // if (this._valkOptions.transactionGroup)
      const packedValue = this._buildLiveKuery(
          this._liveHead, this._liveKuery, scope, triggerBroadcast);
      if (triggerBroadcast) {
        this._value = this._getDiscourse().unpack(packedValue);
        this._triggerOnUpdate();
      }
    } catch (error) {
      this._inactivateHooks();
      if (tryConnectToMissingPartitionsAndThen(error, () => {
        this._invalidateState();
        this._activateHooks(triggerBroadcast);
      })) return;
      throw wrapError(error, `During ${this.debugId()}\n ._activateLiveKueryHooks(), with:`,
          "\n\thead:", ...dumpObject(this._liveHead),
          "\n\tkuery:", ...dumpKuery(this._liveKuery),
          "\n\tscope:", ...dumpObject(scope),
          "\n\toptions.state:", ...dumpObject(options.state && options.state.toJS()),
      );
    } finally {
      if (options.transaction) options.transaction = null;
      if (verbosity) {
        console.log(" ".repeat(options.verbosity),
            `Subscription(${this.debugId()})._activateLiveKueryHooks result:`,
                ...dumpObject(this._value));
        options.verbosity = verbosity;
      }
    }
  }
  */
}
