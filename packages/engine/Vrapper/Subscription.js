// @flow

import type { VALKOptions } from "~/raem/VALK";
import { addStackFrameToError, SourceInfoTag } from "~/raem/VALK/StackTrace";

import { tryConnectToMissingPartitionsAndThen } from "~/raem/tools/denormalized/partitions";

import liveKuerySteppers from "~/engine/Vrapper/liveKuerySteppers";
import Vrapper from "~/engine/Vrapper";
import { Kuery, dumpKuery, dumpObject } from "~/engine/VALEK";
import { LiveUpdate } from "~/engine/Vrapper/FieldUpdate";

import { isSymbol, outputError, thenChainEagerly, wrapError } from "~/tools";

/**
 * Subscription is a shared object which represents a single live kuery
 * or field listeners. It has two main roles:
 * 1. a field handler registerer and a listener for specific field
 *    update notifications on Vrapper's
 * 2. listener tracker for top-level listener callback calls
 *
 * It also has two modes: immediate state mode and transactional mode.
 * Immediate mode is enabled if options.obtainSubscriptionTransaction
 * is not specified. In this mode the subscription value and listener
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

  _attachedHooks: Object;

  constructor (emitter: Vrapper, options: ?VALKOptions) {
    super(emitter);
    this._valkOptions = options ? { ...options } : {};
    if (options && options.obtainSubscriptionTransaction && (options.state !== undefined)) {
      throw new Error(
          "Subscription.options cannot contain both obtainSubscriptionTransaction and state");
    }
  }

  initialize (liveOperation: any, head: ?any) {
    if ((typeof liveOperation === "object") || (head !== undefined)) {
      return this.initializeKuery(liveOperation, head);
    }
    if ((typeof liveOperation === "string") || isSymbol(liveOperation)) {
      return this.initializeField(liveOperation);
    }
    if ((typeof liveOperation === "boolean") || (typeof liveOperation === "function")) {
      return this.initializeFilter(liveOperation);
    }
    throw new Error(`Unrecognized liveOperation of type '${typeof liveOperation
        }'. Expected object, string, symbol, boolean or function`);
  }

  initializeField (fieldName: string) {
    this._fieldName = fieldName;
    return this;
  }

  initializeFilter (fieldFilter: any) {
    this._fieldFilter = fieldFilter;
    return this;
  }

  initializeKuery (liveKuery: any, liveHead: any = this._emitter) {
    this._liveKuery = liveKuery;
    this._liveHead = liveHead;
    // this._valkOptions.noSideEffects = true; // TODO(iridian): Implement this in Valker.
    if (liveKuery instanceof Kuery) {
      this._liveKueryObject = liveKuery;
      this._liveKuery = liveKuery.toVAKON();
      this._valkOptions.sourceInfo = liveKuery[SourceInfoTag];
    }
    return this;
  }

  debugId (options: ?Object): string {
    const name = this._liveKuery !== undefined ? "<kuery>" : this._fieldName || this._fieldFilter;
    return `${this.constructor.name}(${name}, ${this._emitter && this._emitter.debugId(options)})`;
  }

  // Value section

  _refreshState () {
    const options = this._valkOptions;
    if ((options.discourse === null)
        || (options.discourse && !options.discourse.isActiveTransaction())) {
      options.discourse = options.obtainSubscriptionTransaction
          ? options.obtainSubscriptionTransaction()
          : this._emitter.engine.discourse;
    }
    if (options.state === null) {
      options.state = this.getDiscourse().getState();
    }
  }

  _invalidateState () {
    if (this._valkOptions.state) this._valkOptions.state = null;
    if (this._valkOptions.discourse) this._valkOptions.discourse = null;
  }

  _resolveValue (): ?any {
    this._refreshState();
    if (this._fieldName !== undefined) return super._resolveValue();
    if (this._liveKuery !== undefined) {
      try {
        return this.getDiscourse().run(this._liveHead, this._liveKuery, this._valkOptions);
      } catch (error) {
        this._invalidateState();
        const connecting = tryConnectToMissingPartitionsAndThen(error, () => this._resolveValue());
        if (connecting) return connecting;
        throw error;
      } finally {
        if (this._valkOptions.discourse !== undefined) this._valkOptions.discourse = null;
      }
    }
    throw new Error(`Cannot resolve value: ${this._fieldFilter !== undefined
        ? "filter subscription has no value semantics"
        : "subscription not initialized"}`);
  }

  // Listeners will be notified of updates to this subscription

  _listeners = new Map();

  addListenerCallback (listener: any, callbackKey: any, onUpdate: ?Function | boolean,
      immediateUpdate: ?any, asRepeathenable: ?boolean) {
    let callbacks = this._listeners.get(listener);
    if (!callbacks) this._listeners.set(listener, (callbacks = []));
    const subscription = this;
    if (onUpdate) then(onUpdate);
    return asRepeathenable && { then };
    function then (thenOnUpdate) {
      callbacks.push([callbackKey, thenOnUpdate]);
      if (!subscription._attachedHooks) {
        subscription.attachHooks(immediateUpdate !== false);
      } else if (immediateUpdate !== false) {
        subscription._triggerOnUpdate(thenOnUpdate);
      }
    }
  }

  removeListenerCallback (listener: Object, callbackKey: ?any) {
    if (callbackKey !== undefined) {
      const callbacks = this._listeners.get(listener);
      if (!callbacks) return;
      let maxlen = callbacks.length;
      for (let i = 0; i !== maxlen; ++i) {
        if (callbacks[i][0] === callbackKey) callbacks[i--] = callbacks[--maxlen];
      }
      callbacks.length = maxlen;
      if (maxlen) return;
    }
    this._listeners.delete(listener);
  }

  _broadcastUpdate = (liveUpdate: LiveUpdate) => {
    thenChainEagerly(undefined, [
      () => liveUpdate.value(),
      (value) => {
        liveUpdate._value = value;
        for (const [listener, callbacks] of this._listeners) {
          let maxlen = callbacks.length;
          for (let i = 0; i !== maxlen; ++i) {
            let keepCallback;
            try {
              keepCallback = callbacks[i][1](liveUpdate, this);
            } catch (error) {
              outputError(errorOnEmitLiveUpdate.call(
                      this, error, 1, listener, (callbacks[i] || [])[0]),
                  `Exception caught during broadcastUpdate, removing listener callback`);
              keepCallback = false;
            }
            if (keepCallback === false) callbacks[i--] = callbacks[--maxlen];
          }
          callbacks.length = maxlen;
          if (!callbacks.length) this._listeners.delete(listener);
        }
        if (!this._listeners.size) this.detachHooks();
      },
    ], (error, stage) => { throw errorOnEmitLiveUpdate.call(this, error, stage); });
    function errorOnEmitLiveUpdate (error, stage, listener, callbackKey) {
      return wrapError(error, new Error(`_broadcastUpdate(stage #${stage})`),
          "\n\temitter:", liveUpdate.getEmitter(),
          `\n\t${this._liveKuery ? "kuery"
              : this._fieldFilter ? "filter"
              : "fieldName"}:`, this._liveKuery || this._fieldFilter || this._fieldName,
          "\n\tliveUpdate:", liveUpdate,
          "\n\tliveUpdate._value:", ...dumpObject(liveUpdate._value),
          ...(!listener ? [] : [
            "\n\tlistener:", ...dumpObject(listener),
            "\n\tcallbackKey:", callbackKey || "<missing callback>",
          ]),
          "\n\tthis subscription:", ...dumpObject(this));
    }
  }

  // Hooks are attached by this subscription to emitter vrappers to
  // detect changes to subscription upstream data.

  attachHooks (triggerBroadcast: ?boolean) {
    let prestate, state;
    try {
      prestate = this._valkOptions.state;
      if (this._attachedHooks) throw new Error("Hooks are already attached");
      this._attachedHooks = new Map();
      if (triggerBroadcast !== false) this._refreshState();
      state = this._valkOptions.state;
      if (this._fieldFilter !== undefined) {
        this.attachFilterHook(this._emitter, this._fieldFilter, false);
      } else if (this._liveKuery !== undefined) {
        this.attachLiveKueryHooks(triggerBroadcast !== false);
        return; // skip _triggerOnUpdate below
      } else if (this._fieldName === undefined) {
        throw new Error("Subscription is uninitialized, cannot determine listeners");
      }
      if (triggerBroadcast !== false) this._triggerOnUpdate();
    } catch (error) {
      if (this._attachedHooks) this.detachHooks();
      const origin = new Error(
          `During ${this.debugId()}\n .attachHooks(${triggerBroadcast}), with:`);
      const wrappedError = wrapError(error, origin,
          "\n\temitter:", this._emitter,
          ...(this._liveKuery === undefined ? [
            "\n\tfilter:", this._fieldFilter || this._fieldName,
            "\n\tstate:", ...dumpObject(this._valkOptions.state),
            "\n\tstate was:", ...dumpObject(state),
            "\n\tstate prestate:", ...dumpObject(prestate),
          ] : [
            "\n\thead:", ...dumpObject(this._liveHead),
            "\n\tkuery:", ...dumpKuery(this._liveKuery),
            "\n\toptions:", ...dumpObject(this._valkOptions),
          ]),
          "\n\tsubscription:", ...dumpObject(this));
      if (this._valkOptions.sourceInfo) {
        addStackFrameToError(wrappedError, this._liveKuery,
            this._valkOptions.sourceInfo, origin, this._valkOptions.discourse);
      }
      throw wrappedError;
    }
  }

  detachHooks () {
    for (const [hookTarget, callbackKey] of this._attachedHooks) {
      if (callbackKey) {
        // Remove all callbacks at once, no need to remove them one by
        // one even if we encounter multiple callbacks on the same hookTarget.
        hookTarget.removeListenerCallback(this /* , callbackKey */);
      } else hookTarget.delete(this);
    }
    this._attachedHooks = null;
    this._invalidateState();
  }

  triggerFieldUpdate (state: Object, previousState: Object) {
    const passageCounter = this._passage._counter;
    // console.log("triggerFieldUpdate", this.debugId(), passageCounter, this._seenPassageCounter);
    if (this._seenPassageCounter >= passageCounter) return;
    this._seenPassageCounter = passageCounter;
    this._value = undefined;
    this._valkOptions.state = this._passage.state || state;
    this._valkOptions.previousState = previousState;
    this._broadcastUpdate(this);

    if (this._emitter._filterHooks) {
      const fieldIntro = this._emitter.getTypeIntro().getFields()[this._fieldName];
      for (const [subscription, [filter, isStructural]] of this._emitter._filterHooks) {
        try {
          if (filter && ((typeof filter !== "function") || filter(fieldIntro))) {
            subscription.triggerFilterUpdate(isStructural, this, passageCounter);
          }
        } catch (error) {
          outputError(this._emitter.wrapErrorEvent(error,
                  new Error(`Subscription.triggerFieldUpdate('${this._fieldName
                      }').filterHook(${subscription.debugId()}, [${filter}, ${isStructural}])`),
                  "\n\tlive update:", this,
                  "\n\tlive update options:", this.getOptions(),
                  "\n\tfailing filter subscription:", ...dumpObject(subscription),
                  "\n\tstate:", ...dumpObject(this.getState().toJS())),
              `Exception caught during Subscription.triggerFieldUpdate('${this._fieldName}')`);
        }
      }
    }
    this.clearPassageTemporaries();
  }

  attachFilterHook (emitter: Vrapper, filter: Function | boolean, isStructural: ?boolean) {
    // console.log(this.debugId(),
    //     `attachFilterHook(${emitter.debugId()}, ${filter}, ${isStructural})`);
    const hookContainer = emitter._addFilterHook(this, filter, isStructural);
    if (hookContainer) this._attachedHooks.set(hookContainer, null);
  }

  triggerFilterUpdate (isStructural: any, fieldUpdate: LiveUpdate, passageCounter: number) {
    // console.log("triggerFieldUpdate", this.debugId(), isStructural, passageCounter);
    if (this._liveKuery !== undefined) {
      this.triggerKueryUpdate(isStructural, fieldUpdate, fieldUpdate);
    } else if (this._seenPassageCounter < passageCounter) {
      this._seenPassageCounter = passageCounter;
      this._broadcastUpdate(fieldUpdate);
    }
  }

  attachLiveKueryHooks (triggerBroadcast: ?boolean) {
    const options: any = this._valkOptions;
    let scope;
    try {
      scope = this._valkOptions.scope ? Object.create(this._valkOptions.scope) : {};
      this._value = this.getDiscourse().run(this._liveHead, this._liveKuery,
          { ...options, scope, steppers: liveKuerySteppers, kuerySubscription: this });
      if (triggerBroadcast) {
        this._triggerOnUpdate();
      }
    } catch (error) {
      this.detachHooks();
      if (tryConnectToMissingPartitionsAndThen(error, () => {
        this._invalidateState();
        this.attachHooks(triggerBroadcast);
      })) return;
      throw wrapError(error, `During ${this.debugId()}\n .attachLiveKueryHooks(), with:`,
          "\n\thead:", ...dumpObject(this._liveHead),
          "\n\tkuery:", ...dumpKuery(this._liveKuery),
          "\n\tscope:", ...dumpObject(scope),
          "\n\toptions.state:", ...dumpObject(options.state && options.state.toJS()),
      );
    } finally {
      if (options.discourse) options.discourse = null;
    }
  }

  attachKueryFieldHook (emitter: Vrapper, fieldName: string, isStructural: ?boolean) {
    // console.log(this.debugId(),
    //    `\n\t.attachKueryFieldHook(${emitter.debugId()}, ${fieldName}, ${isStructural})`);
    if (this._liveKuery === undefined) {
      throw new Error("Only kuery subscriptions can attach field hooks");
    }
    const fieldSubscription = emitter.obtainFieldSubscription(fieldName);
    if (fieldSubscription) {
      fieldSubscription.addListenerCallback(this, "kuery",
          this.triggerKueryUpdate.bind(this, isStructural), false);
      this._attachedHooks.set(fieldSubscription, "kuery");
    }
  }

  triggerKueryUpdate (isStructural: any, fieldUpdate: LiveUpdate) {
    const passageCounter = fieldUpdate._passage._counter;
    /*
    console.log("triggerKueryUpdate", this.debugId(),
        "\n\tstructural/update:", isStructural, fieldUpdate.debugId(),
        "\n\tpassageCounters:", passageCounter, this._seenPassageCounter,
        "\n\t:", !this._valkOptions.obtainSubscriptionTransaction, !!this._valkOptions.state,
            this._valkOptions.state === fieldUpdate.getState());
    */
    if (this._seenPassageCounter >= passageCounter) return;
    this._seenPassageCounter = passageCounter;
    if (!this._valkOptions.obtainSubscriptionTransaction) {
      const newState = fieldUpdate.getState();
      if (this._valkOptions.state === newState) return;
      this._valkOptions.state = newState;
    }
    this._value = undefined;
    if (isStructural === false) {
      // TODO(iridian, 2019-03): Some of the field handlers are now
      // properly marked as non-structural with hookData === false.
      // Fill the rest too.
      this._broadcastUpdate(this);
      return;
    }
    // TODO(iridian): PERFORMANCE CONCERN: Refreshing the kuery
    // registrations on every update is quite costly. Especially so if
    // the kuery has property traversals: the current inefficient live
    // kuery implementation adds listeners to all _candidate_
    // properties... so that's a lot of re-registered listeners.
    // There are a bunch of algorithmic optimizations that can be done
    // to improve it. Alas, none of them are both trivial and
    // comprehensive to warrant doing before the cost becomes an actual
    // problem.
    this.detachHooks();
    this.attachHooks(true);
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
}
