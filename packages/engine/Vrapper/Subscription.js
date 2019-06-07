// @flow

import type { VALKOptions } from "~/raem/VALK";
import { addStackFrameToError, SourceInfoTag } from "~/raem/VALK/StackTrace";

import { tryConnectToMissingPartitionsAndThen } from "~/raem/tools/denormalized/partitions";

import liveKuerySteppers from "~/engine/Vrapper/liveKuerySteppers";
import Vrapper from "~/engine/Vrapper";
import { Kuery, dumpKuery, dumpObject } from "~/engine/VALEK";
import LiveUpdate from "~/engine/Vrapper/LiveUpdate";

import { ScopeAccessKeysTag } from "~/script/VALSK";

import { debugObject, isSymbol, outputError } from "~/tools";

/**
 * Subscription is a shared object which represents a single live kuery
 * or field listeners. It has two main roles:
 * 1. a field handler registerer and a listener for specific field
 *    update notifications on Vrapper's
 * 2. listener tracker for top-level listener callback calls
 *
 * It also has two modes: immediate state mode and transactional mode.
 * Immediate mode is enabled if obtainDiscourse is not specified.
 * In this mode the subscription value and listener notifications are
 * based on the internal getState() of this subscription. refreshState
 * will fetch the state from the currently active top-level
 * engine.discourse
 *
 * Otherwise transactional mode is enabled. In this mode the
 * obtainDiscourse callback is called to retrieve a new discourse
 * whenever the current discourse is outdated and all operations are
 * performed inside it.
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

  _obtainDiscourse: Function;
  _attachedHooks: Object;

  constructor (emitter: Vrapper, options: ?VALKOptions, obtainDiscourse: ?Function) {
    super(emitter, options);
    if (obtainDiscourse !== undefined) {
      if (options && (options.state !== undefined)) {
        throw new Error(
            "Subscription cannot be configured with both obtainDiscourse and options.state");
      }
      this._obtainDiscourse = obtainDiscourse;
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

  debugId (): string {
    return `${this.constructor.name}(${
      this._fieldName ? `field: ${this._fieldName}`
      : this._fieldFilter ? `filter: ${debugObject(this._fieldName)}`
      : `kuery: ${debugObject(this._liveKuery)}`
    })`;
  }

  matchesKueryOptions (options: ?VALKOptions, obtainDiscourse: ?Function) {
    if (this._obtainDiscourse !== obtainDiscourse) return false;
    const scopeAccessKeys = (this._liveKueryObject || {})[ScopeAccessKeysTag];
    if (!scopeAccessKeys || !scopeAccessKeys.length) return true;
    const candidateScope = options.scope;
    const ownScope = this._valkOptions.scope;
    if (!candidateScope || !ownScope) {
      console.log(
          !scopeAccessKeys ? "no scope access info for:"
          : !candidateScope ? "no candidate options.scope"
          : "no own scope",
          JSON.stringify(this._liveKuery));
      return false;
    }
    for (const name of scopeAccessKeys) {
      if (ownScope[name] !== candidateScope[name]) return false;
      /*
        if (type !== "read") {
          console.log("non-read access encountered for:", name, type, "in",
              JSON.stringify(scopeAccesses),
              "\n\tkuery:", JSON.stringify((kuery.toVAKON && kuery.toVAKON()) || kuery));
          return false;
        }
        if ((subval == null) || (newval == null) || (subval[NativeIdentifierTag] === undefined)
            || (subval[NativeIdentifierTag] !== newval[NativeIdentifierTag])) {
          // console.log("mismatching scope values encountered for:", name,
          //     "\n\tbetween subscope:", subscope[name], "and newscope:", newscope[name],
          //    "\n\tkuery:", JSON.stringify((kuery.toVAKON && kuery.toVAKON()) || kuery));
          return false;
        }
      }
      */
    }
    return true;
  }

  // Value section

  _refreshState () {
    const options = this._valkOptions;
    if ((options.discourse === null)
        || (options.discourse && !options.discourse.isActiveFabricator())) {
      options.discourse = this._obtainDiscourse
          ? this._obtainDiscourse()
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
    function then (callback) {
      callbacks.push([callbackKey, callback]);
      if (!subscription._attachedHooks) {
        subscription.attachHooks(immediateUpdate !== false);
      } else if (immediateUpdate !== false) {
        subscription._triggerPostUpdate(callback);
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
    if (!this._listeners.size) this.detachHooks();
  }

  _broadcastUpdate = (liveUpdate: LiveUpdate, passageCounter: number) => {
    for (const [listener, callbacks] of this._listeners) {
      let maxlen = callbacks.length;
      for (let i = 0; i !== maxlen; ++i) {
        let keepCallback;
        try {
          keepCallback = callbacks[i][1](liveUpdate, passageCounter);
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
    function errorOnEmitLiveUpdate (error, stage, listener, callbackKey) {
      return this._emitter.wrapErrorEvent(error,
          new Error(`${this.debugId()}\n ._broadcastUpdate(stage #${stage}, ${passageCounter})`),
          "\n\tliveUpdate:", ...dumpObject(liveUpdate),
          "\n\tliveUpdate.emitter:", ...dumpObject(liveUpdate.getEmitter()),
          "\n\tliveUpdate._value:", ...dumpObject(liveUpdate._value),
          "\n\tliveUpdate.state:", ...dumpObject(liveUpdate.getState().toJS()),
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
    if (!this._listeners.size) return;
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
        return; // skip _triggerPostUpdate below
      } else if (this._fieldName === undefined) {
        throw new Error("Subscription is uninitialized, cannot determine listeners");
      }
      if (triggerBroadcast !== false) this._triggerPostUpdate();
    } catch (error) {
      if (this._attachedHooks) this.detachHooks();
      const origin = new Error(
          `${this.debugId()}\n .attachHooks(${triggerBroadcast})`);
      const wrappedError = this._emitter.wrapErrorEvent(error,
          origin,
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
    this._invalidateState();
    if (!this._attachedHooks) return false;
    for (const [hookTarget, callbackKey] of this._attachedHooks) {
      if (callbackKey) {
        // Remove all callbacks at once, no need to remove them one by
        // one even if we encounter multiple callbacks on the same hookTarget.
        hookTarget.removeListenerCallback(this /* , callbackKey */);
      } else hookTarget.delete(this);
    }
    this._attachedHooks = null;
    return true;
  }

  triggerFieldUpdate (state: Object, previousState: Object, passageCounter: ?number) {
    // console.log("triggerFieldUpdate", this.debugId(), passageCounter, this._seenPassageCounter);
    if (passageCounter !== undefined) {
      if (this._seenPassageCounter >= passageCounter) return;
      this._seenPassageCounter = passageCounter;
    }
    this._valkOptions.state = state;
    this._valkOptions.previousState = previousState;
    const refreshed = this.refreshValue();
    if (refreshed) this._broadcastUpdate(this, passageCounter);
  }

  attachFilterHook (emitter: Vrapper, filter: Function | boolean, isStructural: ?boolean) {
    // console.log(this.debugId(),
    //     `attachFilterHook(${emitter.debugId()}, ${filter}, ${isStructural})`);
    const hookContainer = emitter._addFilterHook(this, filter, isStructural);
    if (hookContainer) this._attachedHooks.set(hookContainer, null);
  }

  triggerFilterUpdate (isStructural: any, fieldUpdate: LiveUpdate, passageCounter: ?number) {
    // console.log("triggerFieldUpdate", this.debugId(), isStructural, passageCounter);
    if (this._liveKuery !== undefined) {
      this.triggerKueryUpdate(isStructural, fieldUpdate, passageCounter);
      return;
    }
    if (passageCounter !== undefined) {
      if (this._seenPassageCounter >= passageCounter) return;
      this._seenPassageCounter = passageCounter;
    }
    this._broadcastUpdate(fieldUpdate, passageCounter);
  }

  attachLiveKueryHooks (triggerBroadcast: ?boolean) {
    const options: any = Object.create(this._valkOptions);
    let scope;
    try {
      options.scope = this._valkOptions.scope ? Object.create(this._valkOptions.scope) : {};
      options.steppers = Object.create(liveKuerySteppers);
      options.steppers.kuerySubscription = this;
      this._value = this.getDiscourse().run(this._liveHead, this._liveKuery, options);
      if (triggerBroadcast) {
        this._triggerPostUpdate();
      }
    } catch (error) {
      this.detachHooks();
      if (tryConnectToMissingPartitionsAndThen(error, () => {
        this._invalidateState();
        this.attachHooks(triggerBroadcast);
      })) return;
      throw this._emitter.wrapErrorEvent(error,
          `${this.debugId()}\n .attachLiveKueryHooks()`,
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

  triggerKueryUpdate (isStructural: any, fieldUpdate: LiveUpdate, passageCounter) {
    if (passageCounter !== undefined) {
      if (this._seenPassageCounter >= passageCounter) return;
      this._seenPassageCounter = passageCounter;
    }
    /*
    console.log("triggerKueryUpdate", this.debugId(),
        "\n\tstructural/update:", isStructural, fieldUpdate.debugId(),
        "\n\tpassageCounters:", passageCounter, this._seenPassageCounter,
        "\n\t:", !this._obtainDiscourse, !!this._valkOptions.state,
            this._valkOptions.state === fieldUpdate.getState());
    */
    if (!this._obtainDiscourse) {
      const newState = fieldUpdate.getState();
      if (this._valkOptions.state === newState) return;
      this._valkOptions.state = newState;
    }
    if (isStructural === false) {
      // TODO(iridian, 2019-03): Some of the field handlers are now
      // properly marked as non-structural with hookData === false.
      // Fill the rest too.
      if (this.refreshValue()) this._broadcastUpdate(this, passageCounter);
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

  _triggerPostUpdate (onUpdate = this._broadcastUpdate, passageCounter) {
    if (this._fieldFilter === undefined) {
      onUpdate(this, passageCounter);
      return;
    }
    const fieldIntros = this._emitter.getTypeIntro().getFields();
    for (const [fieldName, intro] of Object.entries(fieldIntros)) {
      if (!intro.isGenerated && ((this._fieldFilter === true) || this._fieldFilter(intro))) {
        this._fieldName = fieldName;
        this.refreshValue();
        onUpdate(this, passageCounter);
      }
    }
    this._fieldName = undefined;
    this.clearValue();
  }
}
