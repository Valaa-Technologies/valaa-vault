// @flow

import React from "react";
import PropTypes from "prop-types";

import { tryConnectToAbsentChroniclesAndThen } from "~/raem/tools/denormalized/partitions";

import { Subscription, LiveUpdate } from "~/engine/Vrapper";
import debugId from "~/engine/debugId";
import { dumpKuery, dumpObject } from "~/engine/VALEK";

import Lens from "~/inspire/valosheath/valos/Lens";

import {
  arrayFromAny, invariantify, isPromise, outputError, thisChainEagerly, thisChainReturn, wrapError,
} from "~/tools";

import { clearScopeValue, getScopeValue, setScopeValue } from "./scopeValue";

import {
  _enableError, _toggleError, _clearError,
} from "./_errorOps";
import {
  _componentConstructed, _componentWillReceiveProps, _shouldComponentUpdate, _componentWillUnmount,
} from "./_lifetimeOps";
import {
  // _childProps,
  _checkForRenderDepthFailure,
} from "./_propsOps";
import {
  _renderFocus, _renderFocusAsSequence, _renderFirstAbleDelegate,
  _tryRenderLens, _tryRenderLensArray, _validateElement,
} from "./_renderOps";
import {
  _finalizeUnbindSubscriptions, _getBoundSubscription, _unbindSubscription, _bindLiveKuery
} from "./_subscriberOps";

export function isUIComponentElement (element: any) {
  return (typeof element.type === "function") && element.type.isUIComponent;
}

const _propertyNames = PropTypes.oneOfType([PropTypes.string, PropTypes.arrayOf(PropTypes.string)]);

export default class UIComponent extends React.Component {
  static mainLensSlotName = "uiComponentLens";

  static isUIComponent = true;

  static contextTypes = {
    engine: PropTypes.object,
    parentUIContext: PropTypes.object,

    css: PropTypes.func,
    getVSSSheet: PropTypes.func,
    releaseVssSheets: PropTypes.func,
  }

  static propTypes = {
    children: PropTypes.any, // children can also be a singular element.

    focus: PropTypes.any,
    context: PropTypes.object,

    arrayIndex: PropTypes.number,
    elementIndex: PropTypes.number,

    style: PropTypes.object,

    // kuery: PropTypes.instanceOf(Kuery),
    // head: PropTypes.any, // obsolete alias for focus.

    delegate: PropTypes.arrayOf(PropTypes.any),

    delayed: PropTypes.any,

    loadingLens: PropTypes.any,
    loadingFailedLens: PropTypes.any,

    pendingLens: PropTypes.any,
    rejectedLens: PropTypes.any,

    pendingPromiseLens: PropTypes.any,
    rejectedPromiseLens: PropTypes.any,

    nullLens: PropTypes.any,
    undefinedLens: PropTypes.any,
    lens: PropTypes.any,

    pendingChroniclesLens: PropTypes.any,
    rejectedChroniclesLens: PropTypes.any,

    pendingFocusLens: PropTypes.any,
    rejectedFocusLens: PropTypes.any,

    pendingFrameLens: PropTypes.any,
    rejectedFrameLens: PropTypes.any,

    pendingMediaLens: PropTypes.any,
    rejectedMediaLens: PropTypes.any,
    uninterpretableMediaLens: PropTypes.any,
    unrenderableInterpretationLens: PropTypes.any,

    resourceLens: PropTypes.any,
    activeLens: PropTypes.any,
    activatingLens: PropTypes.any,
    inactiveLens: PropTypes.any,
    unavailableLens: PropTypes.any,
    destroyedLens: PropTypes.any,

    lensProperty: _propertyNames,
    focusLensProperty: _propertyNames,
    delegateLensProperty: _propertyNames,
    instanceLensProperty: _propertyNames,

    pendingAttributesLens: PropTypes.any,
    rejectedAttributesLens: PropTypes.any,

    pendingElementsLens: PropTypes.any,
    rejectedElementsLens: PropTypes.any,
    lensPropertyNotFoundLens: PropTypes.any,
  }

  static childContextTypes = {
    parentUIContext: PropTypes.object,
  };

  static propsCompareModesOnComponentUpdate = {
    children: "shallow",
    focus: "shallow",
    head: "shallow",
    context: "onelevelshallow",
    reactComponent: "ignore",
    frameOverrides: "ignore",
  }

  static stateCompareModesOnComponentUpdate = {}

  constructor (props: any, context: any, extraState: Object) {
    super(props, context);
    const uiContext = Object.create(context.parentUIContext);
    uiContext.context = uiContext;
    uiContext.reactComponent = this;
    const renderDepth = uiContext[Lens.currentRenderDepth] =
        context.parentUIContext[Lens.currentRenderDepth] + 1;
    const maximumRenderDepth = uiContext[Lens.maximumRenderDepth];
    if ((maximumRenderDepth !== undefined) && (renderDepth > maximumRenderDepth + 10)) {
      // This error denotes a secondary failure in the UIComponent..render
      // error handling code itself which checks for the max depth.
      throw new Error(
          `INTERNAL ERROR: max depth greatly exceeded ${renderDepth} > ${maximumRenderDepth} + 10`);
    }

    this.state = {
      error: undefined,
      errorHidden: false,
      uiContext,
      ...(extraState || {}),
    };

    this._subscriptions = {};
    this._isConstructing = true;
    try {
      _componentConstructed(this, props, context);
    } catch (error) {
      this.enableError(wrapError(error,
              new Error(`During ${this.debugId()})\n .constructor(), with:`),
              "\n\tuiContext:", this.state.uiContext,
              "\n\tstate:", this.state,
              "\n\tprops:", this.props,
          ), "UIComponent.constructor");
    }
    this._isConstructing = false;
  }

  getChildContext () {
    return {
      parentUIContext: this.state.uiContext,
    };
  }

  state: Object;
  _activeParentFocus: ?any;

  // React section: if overriding remember to super() call these base implementations

  UNSAFE_componentWillReceiveProps (nextProps: Object, nextContext: any, // eslint-disable-line
      forceReattachListeners: ?boolean) {
    try {
      _componentWillReceiveProps(this, nextProps, nextContext, forceReattachListeners);
    } catch (error) {
      this.enableError(wrapError(error,
              new Error(`During ${this.debugId()})\n .componentWillReceiveProps(), with:`),
              "\n\tuiContext:", this.state.uiContext,
              "\n\tstate:", this.state,
              "\n\tprops:", this.props,
              "\n\tnextProps:", nextProps,
          ), "UIComponent.componentWillReceiveProps");
    }
  }

  shouldComponentUpdate (nextProps: Object, nextState: Object, nextContext: Object): boolean {
    try {
      const ret = _shouldComponentUpdate(this, nextProps, nextState, nextContext);
      if (ret) this._cachedRendering = undefined;
      return ret;
    } catch (error) {
      this.enableError(wrapError(error,
              new Error(`During ${this.debugId()})\n .shouldComponentUpdate(), with:`),
              "\n\tprops:", this.props,
              "\n\tnextProps:", nextProps,
              "\n\tstate:", this.state,
              "\n\tnextState:", nextState,
              "\n\tcontext:", this.context,
              "\n\tnextContext:", nextContext,
          ), "UIComponent.shouldComponentUpdate");
    }
    return true;
  }

  componentWillUnmount () {
    try {
      _componentWillUnmount(this);
    } catch (error) {
      outputError(wrapError(error,
              new Error(`During ${this.debugId()})\n .componentWillUnmount(), with:`),
              "\n\tprops:", this.props,
              "\n\tstate:", this.state,
              "\n\tcontext:", this.context,
          ), "Exception caught in UIComponent.componentWillUnmount");
    }
  }

  setState (newState: any, callback: any) {
    if (!this._isConstructing) super.setState(newState, callback);
    else {
      // Performance optimization: mutate state directly if not mounted
      // or just mounting. setState calls are queued and could result
      // in costly re-renders when called from componentWillMount,
      // strangely enough.
      //
      // TODO(iridian): I find this a bit surprising: I would expect
      // React to precisely to do this optimization itself in
      // componentWillMount (ie. not calling re-render), so it might be
      // something else we're doing wrong with the codebase. But adding
      // this here resulted in cutting the render time fully in half.
      //
      // TODO(iridian, 2019-03): We most certainly were doing something
      // wrong, but as some of the React lifecycle functions are being
      // deprecated anyway, we should rework the whole system instead
      // of trying to figure out exactly how we used the deprecated
      // system wrong.
      Object.assign(this.state,
          typeof newState === "function"
            ? newState(this.state, this.props)
            : newState);
      if (callback) callback();
    }
  }

  // Public API

  maybeDelayed (delayingLensName, value) {
    const delayed = this.props.delayed;
    return delayed && (delayed === true
          || (delayed === delayingLensName)
          || (Array.isArray(delayed) && delayed.includes(delayingLensName)))
        ? new Promise(resolve => setTimeout(() => resolve(value), 0))
        : value;
  }

  /**
   * Returns the current focus of this UI component or throws if this component is disabled.
   */
  getFocus (state: Object = this.state) {
    const ret = this.tryFocus(state);
    invariantify(ret !== undefined, `${this.constructor.name
        }.getFocus() called when component is disabled (focus/head is undefined)`);
    return ret;
  }

  tryFocus (state: Object = this.state) {
    const ret = getScopeValue(state.uiContext, "focus");
    return (ret !== undefined)
        ? ret
        : getScopeValue(state.uiContext, "head");
  }

  /**
   * Returns the current UI uiContext of this UI component or null if this component is disabled.
   */
  getUIContext () {
    return this.state.uiContext;
  }

  getUIContextValue (key: string | Symbol) {
    return getScopeValue(this.state.uiContext, key);
  }

  getParentUIContextValue (key: string | Symbol) {
    return getScopeValue(Object.getPrototypeOf(this.getUIContext()), key);
  }

  trySetUIContextValue (key: string | Symbol, value: any) {
    if (!this.state.uiContext) return false;
    this.setUIContextValue(key, value);
    return true;
  }

  setUIContextValue (key: string | Symbol, value: any) {
    setScopeValue(this.state.uiContext, key, value);
    return value;
  }

  tryClearUIContextValue (key: string | Symbol) {
    if (!this.state.uiContext) return false;
    return this.clearUIContextValue(key);
  }

  clearUIContextValue (key: string | Symbol) {
    return clearScopeValue(this.state.uiContext, key);
  }

  getKey () {
    return this.context.parentUIContext.reactComponent.getKey();
  }

  readSlotValue (slotName: string, slotSymbol: Symbol, focus: any, onlyIfAble?: boolean,
      props = this.props):
    void | null | string | React.Element<any> | [] | Promise<any> {
    if (onlyIfAble) {
      const descriptor = this.context.engine.getHostObjectDescriptor(slotSymbol);
      if (descriptor) {
        if ((typeof descriptor.isEnabled === "function") && !descriptor.isEnabled(focus, this)) {
          return undefined;
        }
        const value = descriptor.value;
        if (value !== undefined) {
          return (typeof value !== "function") ? value : value(focus, this);
        }
      }
    }
    let assignee;
    try {
      assignee = props[slotName];
      if (assignee === undefined) {
        if (props.hasOwnProperty(slotName)) {
          throw new Error(`Attribute slot '${slotName}' value must not be undefined`);
        }
        assignee = this.getUIContextValue(slotSymbol);
        if (assignee === undefined) {
          assignee = this.context[slotName];
          if (assignee === undefined) return undefined;
        } else if (Array.isArray(assignee) && !Object.isFrozen(assignee)) {
          assignee = [...assignee]; // the lens chain constantly mutates assignee, return a copy
        }
      }
      return assignee;
    } catch (error) {
      throw wrapError(error,
          `During ${this.debugId()}\n .readSlotValue, with:`,
          "\n\tfocus:", focus,
          "\n\tslotName:", slotName,
          "\n\tslotSymbol:", slotSymbol,
          "\n\tassignee:", assignee);
    }
  }

  _subscriptions: Object;

  static _debugIdExcludedPropsKeys = ["focus", "hierarchyKey", "frameKey"];

  debugId (options: ?Object) {
    const keyString = this.getKey() || "no key";
    let focus = this.getUIContextValue("focus");
    if (focus === undefined) focus = this.getUIContextValue("head");
    return `<${this.constructor.name} key="${keyString}" focus={${Array.isArray(focus)
      ? `[${focus.map(entry => debugId(entry, { short: true, ...options })).join(", ")}]`
      : debugId(focus, { short: true, ...options })}}${
        Object.entries(this.props)
            .filter(([key]) => !UIComponent._debugIdExcludedPropsKeys.includes(key))
            .map(([key, value]) => `${key}=${
                !value || typeof value !== "object" ? JSON.stringify(value)
      : Array.isArray(value) ? "[...]" : "{...}"}`)} />`;
  }

  /**
   * Bind the given subscription to the given bindingSlot of this
   * UIComponent. A possible existing subscription in that bindingSlot
   * is unsubscribed. When the component is unmounted, destroyed or if
   * the focus of this component changes all current bindings are
   * unsubscribed and possible reattached.
   *
   * Guide to consistent naming of bindingSlot:
   *
   * Basic fields: `${componentName}.${fieldNameOnHead}.${_subscribedFieldName}`
   *   example: "EditorNode.editTarget.name"
   *     starts from this.getFocus(), goes to focus.step("editTarget"),
   *     subscribes for "name" on it
   *
   * Properties: `${componentName}['${propertyName}']`
   *   example: "DialogueEditor['editTarget']
   *     subscribes implicitly field 'Property.value' if no followup
   *   example: "DialogueEditor['editTarget'].name"
   *     treats Property.value as Identifier and subscribes to 'name'
   *     of the Identifier.reference
   *
   * Kuery or complex subscribers: `${componentName}.(${ruleName})`
   *   example: "Field.(toShown)"
   *     subscribes to a complex rule or kuery called toShown of Field
   *     focus
   *
   * Others:
   *   example "PropertiesPanel.*"
   *     subscribes to all fields of PropertiesPanel focus
   *   example `EditorNode.relation#${vAddedRleation.rawId}.*`
   *     subscribes to all fields on a particularily identified relation
   *
   * @param {string} bindingSlot
   * @param {Subscription} subscriber
   * @returns {Subscription}
   */
  getBoundSubscription (bindingSlot: string): Subscription {
    return _getBoundSubscription(this, bindingSlot);
  }

  unbindSubscription (bindingSlot: string, options: { require?: boolean } = {}) {
    return _unbindSubscription(this, bindingSlot, options);
  }

  /**
   * Create a new kuery subscription and bind it to the given
   * bindingSlot of this component. \see bindSubscription.
   */
  bindLiveKuery (bindingSlot: string, head: any, kuery: any, options: {
    asRepeathenable: boolean, onUpdate: (liveUpdate: LiveUpdate) => ?boolean,
    updateImmediately?: boolean,
    // ...rest are VALKOptions that are forwarded to the kuery runner.
  }) {
    try {
      return _bindLiveKuery(this, bindingSlot, head, kuery, options);
    } catch (error) {
      throw wrapError(error, `During ${this.debugId()}\n .bindLiveKuery(${
              bindingSlot}), with:`,
          "\n\thead:", ...dumpObject(head),
          "\n\tkuery:", ...dumpKuery(kuery),
          "\n\toptions:", ...dumpObject(options),
      );
    }
  }

  // Overridable callbacks. Remember to call base class implementations with super.

  /**
   * Override to update subscribers whenever the focus has changed.
   * If the focus is undefined disables this component.
   * Initiated from "componentWillMount" and "componentWillReceiveProps".
   * When subscribers are registered to the UIComponent itself using
   * bindSubscription deregistration happens automatically for the
   * previous foci and when "componentWillUnmount".
   */
  bindFocusSubscriptions (focus: any, props: Object) { // eslint-disable-line no-unused-vars
    this._areSubscriptionsBound = true;
    return true; // force-update by default
  }

  unbindSubscriptions (/* focus: ?Vrapper */) {
    return _finalizeUnbindSubscriptions(this);
  }

  _isConstructing: boolean;
  _areSubscriptionsBound: ?boolean;

  // Helpers

  enableError (error: string | Error, outputHeader: ?string) {
    const ret = _enableError(this, error);
    if (outputHeader) outputError(error, `Exception caught in ${outputHeader}`);
    return ret;
  }
  toggleError () { return _toggleError(this); }
  clearError () { return _clearError(this); }

  // defaults to lens itself
  renderLens (lens: any, focus?: any, lensName: string, onlyIfAble?: boolean, onlyOnce?: boolean):
      null | string | React.Element<any> | [] | Promise<any> {
    const ret = this.tryRenderLens(lens, focus, lensName, onlyIfAble, onlyOnce);
    return (ret !== undefined) ? ret : lens;
  }

  tryRenderLens (lens: any, focus: any = this.tryFocus(), lensName: string, onlyIfAble?: boolean,
      onlyOnce?: boolean): void | null | string | React.Element<any> | [] | Promise<any> {
    try {
      return _tryRenderLens(this, lens, focus, lensName, onlyIfAble, onlyOnce);
    } catch (error) {
      throw wrapError(error, `During ${this.debugId()}\n .renderLens, with:`,
          "\n\tlensName:", lensName,
          "\n\tlens:", lens,
          "\n\ttypeof lens:", typeof lens,
          "\n\tfocus:", ...dumpObject(focus));
    }
  }

  // defaults to arrayFromAny(sequence)
  renderLensSequence (sequence: any, focus: any = this.tryFocus(), lensName: ?string):
      [] | Promise<any[]> {
    const array = arrayFromAny(sequence !== null ? sequence : undefined);
    const ret = _tryRenderLensArray(this, array, focus, lensName);
    return (ret !== undefined) ? ret : array;
  }

  tryRenderLensSequence (sequence: any, focus: any = this.tryFocus(), lensName: ?string):
      void | [] | Promise<any[]> {
    return _tryRenderLensArray(this, arrayFromAny(sequence), focus, lensName);
  }

  renderLoaded (focus: any):
      null | string | React.Element<any> | [] | Promise<any> {
    return _renderFocus(this, focus);
  }

  renderFocusAsSequence (
      foci: any[], EntryElement: Object = UIComponent, entryProps: Object, entryChildren: Array,
      options: {
        keyFromFocus: ?(focus: any, index: number) => string,
        renderRejection?: (focus: any, index: number) => undefined | any,
        sortCompare?: (lFocus: any, rFocus: any, lProps: Object, rProps: Object) => number,
        offset?: number,
        limit?: number,
        onlyPostRender?: Boolean,
      }
  ): [] {
    return _renderFocusAsSequence(this, foci, EntryElement, entryProps, entryChildren, options);
  }

  // defaults to null
  renderSlotAsLens (slot: string | Symbol, focus: any, rootSlotName?: string, lensName: ??string,
      onlyIfAble?: boolean, onlyOnce?: boolean):
          null | string | React.Element<any> | [] | Promise<any> {
    const ret = this.tryRenderSlotAsLens(slot, focus, rootSlotName, lensName, onlyIfAble, onlyOnce);
    return (ret !== undefined) ? ret : null;
  }

  renderFirstEnabledDelegate (delegates: any[], focus: any = this.tryFocus(), lensName: string):
      null | string | React.Element<any> | [] | Promise<any> {
    return _renderFirstAbleDelegate(this, delegates, focus, lensName);
  }

  tryRenderSlotAsLens (slot: string | Symbol, focus: any = this.tryFocus(),
      rootSlotName_?: string, lensName: ?string, onlyIfAble?: boolean, onlyOnce?: boolean):
          void | null | string | React.Element<any> | [] | Promise<any> {
    let slotValue, ret = null; // eslint-disable-line
    const slotName = typeof slot === "string" ? slot : Lens[slot];
    const slotSymbol = typeof slot !== "string" ? slot : Lens[slot];
    const rootSlotName = rootSlotName_ || slotName;
    const slotAssembly = this.getUIContextValue(Lens.slotAssembly) || [];
    const assemblyLength = slotAssembly.length;
    slotAssembly.push(slotName);
    try {
      if (!slotSymbol) throw new Error(`No valos.Lens slot symbol for '${slotName}'`);
      if (!slotName) throw new Error(`No valos.Lens slot name for '${String(slotSymbol)}'`);
      slotValue = this.readSlotValue(slotName, slotSymbol, focus, onlyIfAble);
      ret = slotValue && this.renderLens(
          slotValue, focus, `[${rootSlotName}]<-${lensName || ""}`, undefined, onlyOnce);
      return ret;
    } catch (error) {
      throw wrapError(error, `During ${this.debugId()}\n .renderSlotAsLens(${
              slotName || String(slotSymbol)}), with:`,
          "\n\tfocus:", focus,
          "\n\tslot value:", slotValue,
          "\n\trootSlotName:", rootSlotName);
    } finally {
      if ((ret == null) && (assemblyLength < slotAssembly.length)) {
        slotAssembly.splice(assemblyLength);
      }
    }
  }

  static thirdPassErrorElement =
      <div>Error caught while rendering error, see console for more details</div>;

  flushAndRerender (cause: string, stateUpdates, explicitRenderResult) {
    this._cachedRenderResult = explicitRenderResult;
    this._cachedRendering = (explicitRenderResult === undefined)
        ? undefined
        : (this.state.rerenderings || 0) + 1;
    this.rerender(cause, (stateUpdates !== null) ? stateUpdates : undefined);
  }

  rerender (cause: string, stateUpdates) {
    if (stateUpdates === null) {
      this.forceUpdate();
    } else {
      this.setState({ rerenderings: (this.state.rerenderings || 0) + 1, ...(stateUpdates || {}) });
    }
  }

  static _counter = 0;

  static _renderChain = [
    UIComponent.prototype._renderMainLensSlot,
    UIComponent.prototype._validateRenderResult,
  ];

  render (): null | string | React.Element<any> | [] {
    let ret;
    try {
      if ((this._cachedRendering !== undefined)
          && (this._cachedRendering === this.state.rerenderings)) {
        return this._cachedRenderResult;
      }
      if (this.state.uiContext) this.setUIContextValue(Lens.slotAssembly, []);
      const chainHead = this._stickyErrorObject
          || _checkForRenderDepthFailure(this)
          || this.maybeDelayed(Lens.pendingElementsLens, this.state.rerenderings || 0);
      const chainResult = thisChainEagerly(
          this,
          chainHead,
          UIComponent._renderChain,
          UIComponent.prototype._errorOnRenderChain);
      if (typeof chainResult === "number") {
        ret = this._cachedRenderResult; // newly set by chain
        if (ret === undefined) {
          throw new Error(`INTERNAL ERROR: render chain returned ${chainResult
              } directly but didn't set _cachedRenderResult`);
        }
      } else { // chainResult is a promise
        chainResult.then(successfulRendering => {
          if (successfulRendering >= 0) {
            this._cachedRendering = successfulRendering;
            this.rerender("elements", null);
          }
        }).catch(error => {
          this.flushAndRerender("elements", undefined,
              this._renderSecondaryError(
                  new Error(`INTERNAL ERROR: ${this.constructor.name
                      }..render main elements chain rendering threw while it shouldn't`),
                  error));
        });

        if (this._cachedRenderResult !== undefined) {
          // Keep showing current result until refresh.
          // Maybe add a timer that will trigger pending lens rendering after a while?
          ret = this._cachedRenderResult;
        } else {
          const operationInfo = chainResult.operationInfo || {
            slotName: "pendingElementsLens", focus: {
              render: chainResult, latestRenderedLensSlot: this.constructor.mainLensSlotName,
            },
            onError: { slotName: "rejectedElementsLens", lens: { render: chainResult } },
          };
          ret = this.tryRenderSlotAsLens(operationInfo.slotName, operationInfo.focus);
          if ((ret === undefined) || isPromise(ret)) {
            throw wrapError(
                new Error(
                    `Invalid render result: slot '${operationInfo.slotName}' renders into ${
                      ret === undefined ? "undefined" : "a promise"}`),
                new Error(`During ${this.debugId()}\n .render().ret.pendingElementsLens, with:`),
                "\n\treturned promise:", ...dumpObject(ret),
                "\n\toperation:", ...dumpObject(operationInfo),
                "\n\tcomponent:", ...dumpObject(this));
          }
        }
      }
    } catch (error) {
      ret = this._cachedRenderResult = this._renderSecondaryError(
          new Error(`INTERNAL ERROR: ${this.constructor.name
              }..render main elements chain rendering threw while it shouldn't`),
          error);
    }
    return ret;
  }

  _renderMainLensSlot (errorOrThisRendering) {
    if (errorOrThisRendering instanceof Error) throw errorOrThisRendering;
    if ((this._cachedRendering !== undefined) && (errorOrThisRendering <= this._cachedRendering)) {
      // Some other call already started main lens slot rendering before this chain call.
      return thisChainReturn(-1);
    }
    return [
      // take ownership of this rendering instance
      this._cachedRendering = (this.state.rerenderings || 0),
      this.tryRenderSlotAsLens(this.constructor.mainLensSlotName),
    ];
  }

  _validateRenderResult (thisRendering, renderResult) {
    if (thisRendering < (this._cachedRendering || 0)) {
      // Some later rerender call finished before this chain call. Discard all.
      return -1;
    }
    if (renderResult === undefined) {
      this._cachedRenderResult = null;
    } else {
      const mainValidationFaults = _validateElement(renderResult);
      if (mainValidationFaults !== undefined) {
        throw wrapError(
            new Error(`Validation faults on render result`),
            new Error(`During ${this.debugId()
                }\n .render().renderSlotAsLens('${this.constructor.mainLensSlotName}')`),
            "\n\tfaults:", ...dumpObject(mainValidationFaults),
            "\n\tfailing render result:", ...dumpObject(renderResult),
            "\n\tcomponent:", ...dumpObject(this),
        );
      }
      this._cachedRenderResult = renderResult;
    }
    return thisRendering;
  }

  _errorOnRenderChain (error = "", index, params) {
    const thisRendering = Array.isArray(params) ? params[0] : (this.state.rerenderings || 0);
    if (thisRendering < (this._cachedRendering || 0)) return -1;
    // Try to connect to absent chronicles.
    try {
      this._cachedRendering = thisRendering;
      if (tryConnectToAbsentChroniclesAndThen(error, () => this.flushAndRerender("sourcery"))) {
        this._cachedRenderResult = this.tryRenderSlotAsLens("pendingChroniclesLens",
            (error.originalError || error).absentChronicleURIs.map(entry => String(entry)));
      } else {
        // if (operationInfo.onError) Object.assign(error, operationInfo.onError);
        outputError(wrapError(error,
                new Error(`During ${this.debugId()}\n .render().result.catch`),
                "\n\tuiContext:", ...dumpObject(this.state.uiContext),
                "\n\tfocus:", ...dumpObject(this.tryFocus()),
                "\n\tcomponent:", ...dumpObject(this),
            ), `${this.constructor.name}..render`);

        const errorSlotName = error.slotName || "internalErrorLens";
        const errorResult = this.renderSlotAsLens(errorSlotName, error);
        if (isPromise(errorResult)) throw new Error(`${errorSlotName} returned a promise`);
        const errorResultValidationFaults = _validateElement(errorResult);
        if (errorResultValidationFaults) {
          throw wrapError(
              new Error("Error rendering itself contains validation faults"),
              new Error(`During ${this.debugId()
                  }\n .render()._errorOnRenderChain("${error.message}")`),
              "\n\tfaults:", ...dumpObject(errorResultValidationFaults),
              "\n\tfailing error result:", ...dumpObject(errorResult),
              "\n\tcomponent:", ...dumpObject(this));
        }
        if ((error.isSticky !== undefined)
            ? error.isSticky
            : (this.context.engine.getHostObjectDescriptor(Lens[errorSlotName]) || {})
                .isStickyError) {
          this._stickyErrorObject = error;
        }
        this._cachedRenderResult = errorResult || null;
      }
    } catch (secondaryError) {
      this._cachedRenderResult = this._renderSecondaryError(secondaryError, error);
    }
    return thisRendering;
  }

  _renderSecondaryError (secondaryError, primaryError) {
    // Exercise in defensive programming. During valospace development
    // we should never get here really. But edge cases happena and
    // during fabric development especially this function serves as a
    // stop-gap measure to ensure that something useful gets rendered.
    try {
      outputError(wrapError(secondaryError,
          `INTERNAL ERROR: Exception caught in ${this.constructor.name
              }.render() second pass,`,
          "\n\twhile rendering primary error:", ...dumpObject(primaryError),
          "\n\tin component:", ...dumpObject(this)));
      return (
        <div>
          Exception caught while trying to render error:
          {String(secondaryError)}, see console for more details
        </div>
      );
    } catch (tertiaryError) {
      try {
        console.error(
            "INTERNAL ERROR: Exception caught on render() third pass:",
            ...dumpObject(tertiaryError),
            "\n\twhile rendering secondary error:", ...dumpObject(secondaryError),
            "\n\tprimary error:", ...dumpObject(primaryError),
            "\n\tin component:", ...dumpObject(this));
        return UIComponent.thirdPassErrorElement || null;
      } catch (quaternaryError) {
        console.warn(
            "INTERNAL ERROR: Exception caught on render() fourth pass:", String(quaternaryError),
            "\n\tGiving up, rendering null.",
            "\n\tYou can ask iridian for candy if you ever genuinely encounter this.");
        return null;
      }
    }
  }
}
