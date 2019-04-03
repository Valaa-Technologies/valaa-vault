// @flow

import React from "react";
import PropTypes from "prop-types";

import { tryConnectToMissingPartitionsAndThen } from "~/raem/tools/denormalized/partitions";

import { Subscription, LiveUpdate } from "~/engine/Vrapper";
import debugId from "~/engine/debugId";
import { Kuery, dumpKuery, dumpObject } from "~/engine/VALEK";

import Presentable from "~/inspire/ui/Presentable";

import { arrayFromAny, invariantify, isPromise, outputError, wrapError }
    from "~/tools";

import { clearScopeValue, getScopeValue, setScopeValue } from "./scopeValue";
import { presentationExpander } from "./presentationHelpers";

import {
  _enableError, _toggleError, _clearError,
} from "./_errorOps";
import {
  _componentWillMount, _componentWillReceiveProps, _shouldComponentUpdate, _componentWillUnmount,
} from "./_lifetimeOps";
import {
  _childProps, _checkForInfiniteRenderRecursion,
} from "./_propsOps";
import {
  _renderFocus, _renderFocusAsSequence, _renderFirstAbleDelegate,
  _tryRenderLens, _readSlotValue, _tryRenderLensArray, _validateElement,
} from "./_renderOps";
import {
  VSSStyleSheetSymbol,
} from "./_styleOps";
import {
  _finalizeUnbindSubscriptions, _getBoundSubscription, _unbindSubscription, _bindLiveKuery
} from "./_subscriberOps";

export function isUIComponentElement (element: any) {
  return (typeof element.type === "function") && element.type.isUIComponent;
}

const _propertyNames = PropTypes.oneOfType([PropTypes.string, PropTypes.arrayOf(PropTypes.string)]);

export default @Presentable(require("./presentation").default, "UIComponent")
class UIComponent extends React.Component {
  static mainLensSlotName = "uiComponentLens";

  static _defaultPresentation = () => ({ root: {} });

  static isUIComponent = true;

  static contextTypes = {
    css: PropTypes.func,
    styleSheet: PropTypes.any,
    getVSSSheet: PropTypes.func,
    releaseVssSheets: PropTypes.func,
    engine: PropTypes.object,

    loadingLens: PropTypes.any,
    loadingFailedLens: PropTypes.any,
    internalErrorLens: PropTypes.any,

    pendingLens: PropTypes.any,
    failedLens: PropTypes.any,

    disabledLens: PropTypes.any,
    nullLens: PropTypes.any,
    undefinedLens: PropTypes.any,
    lens: PropTypes.any,

    pendingConnectionsLens: PropTypes.any,
    failedConnectionsLens: PropTypes.any,
    pendingActivationLens: PropTypes.any,
    failedActivationLens: PropTypes.any,
    pendingMediaInterpretationLens: PropTypes.any,
    failedMediaInterpretationLens: PropTypes.any,
    unrenderableMediaInterpretationLens: PropTypes.any,
    mediaInterpretationErrorLens: PropTypes.any,

    resourceLens: PropTypes.any,
    activeLens: PropTypes.any,
    inactiveLens: PropTypes.any,
    unavailableLens: PropTypes.any,
    destroyedLens: PropTypes.any,

    lensProperty: _propertyNames,
    focusLensProperty: _propertyNames,
    delegateLensProperty: _propertyNames,
    instanceLensProperty: _propertyNames,

    kueryingFocusLens: PropTypes.any,
    kueryingPropsLens: PropTypes.any,
    pendingPropsLens: PropTypes.any,
    failedPropsLens: PropTypes.any,
    pendingChildrenLens: PropTypes.any,
    failedChildrenLens: PropTypes.any,
    lensPropertyNotFoundLens: PropTypes.any,
  }

  static propTypes = {
    children: PropTypes.any, // children can also be a singular element.
    _presentation: PropTypes.any, // TODO(iridian, 2018-12): Get rid of the presentation layer.
    style: PropTypes.object,
    styleSheet: PropTypes.any,
    // If no uiContext nor parentUIContext the component is disabled. Only one of these two can be
    // given at the same time: if uiContext is given uiContext.focus is used directly,
    // otherwise parentUIContext.focus is taken as the focus and kuery is live-tracked against it.
    // If kuery is not given, parentUIContext.focus is used directly.
    uiContext: PropTypes.object,
    elementKey: PropTypes.string,
    parentUIContext: PropTypes.object,
    focus: PropTypes.any,
    kuery: PropTypes.instanceOf(Kuery),
    head: PropTypes.any, // obsolete alias for focus.
    locals: PropTypes.object,
    context: PropTypes.object,

    delegate: PropTypes.arrayOf(PropTypes.any),

    loadingLens: PropTypes.any,
    loadingFailedLens: PropTypes.any,
    internalErrorLens: PropTypes.any,

    pendingLens: PropTypes.any,
    failedLens: PropTypes.any,

    disabledLens: PropTypes.any,
    nullLens: PropTypes.any,
    undefinedLens: PropTypes.any,
    lens: PropTypes.any,

    pendingConnectionsLens: PropTypes.any,
    failedConnectionsLens: PropTypes.any,
    pendingActivationLens: PropTypes.any,
    failedActivationLens: PropTypes.any,
    pendingMediaInterpretationLens: PropTypes.any,
    failedMediaInterpretationLens: PropTypes.any,
    unrenderableMediaInterpretationLens: PropTypes.any,
    mediaInterpretationErrorLens: PropTypes.any,

    resourceLens: PropTypes.any,
    activeLens: PropTypes.any,
    inactiveLens: PropTypes.any,
    unavailableLens: PropTypes.any,
    destroyedLens: PropTypes.any,

    lensProperty: _propertyNames,
    focusLensProperty: _propertyNames,
    delegateLensProperty: _propertyNames,
    instanceLensProperty: _propertyNames,

    kueryingFocusLens: PropTypes.any,
    kueryingPropsLens: PropTypes.any,
    pendingPropsLens: PropTypes.any,
    failedPropsLens: PropTypes.any,
    pendingChildrenLens: PropTypes.any,
    failedChildrenLens: PropTypes.any,
    lensPropertyNotFoundLens: PropTypes.any,
  }

  static noPostProcess = {
    children: true,
    kuery: true,
  }


  static propsCompareModesOnComponentUpdate = {
    _presentation: "ignore",
    uiContext: "shallow",
    parentUIContext: "shallow",
    focus: "shallow",
    head: "shallow",
    locals: "shallow",
    context: "shallow",
  }

  static stateCompareModesOnComponentUpdate = {}

  constructor (props: any, context: any) {
    super(props, context);
    invariantify(!(props.uiContext && props.parentUIContext),
        `only either ${this.constructor.name
            }.props.uiContext or ...parentUIContext can be defined at the same time`);
    invariantify(this.constructor.contextTypes.css,
        `${this.constructor.name}.contextTypes is missing css, ${
        ""}: did you forget to inherit super contextTypes somewhere? ${
        ""} (like: static ContextTypes = { ...Super.contextTypes, ...)`);
    this.state = { error: undefined, errorHidden: false };
    this._subscriptions = {};
  }

  state: Object;
  _activeParentFocus: ?any;

  // React section: if overriding remember to super() call these base implementations

  componentWillMount () {
    try {
      _componentWillMount(this);
    } catch (error) {
      const finalError = wrapError(error,
          new Error(`During ${this.debugId()})\n .componentWillMount(), with:`),
          "\n\tuiContext:", this.state.uiContext,
          "\n\tstate:", this.state,
          "\n\tprops:", this.props,
      );
      outputError(finalError, "Exception caught in UIComponent.componentWillMount");
      this.enableError(finalError);
    }
    this._isMounted = true;
  }

  componentWillReceiveProps (nextProps: Object, nextContext: any,
      forceReattachListeners: ?boolean) {
    try {
      _componentWillReceiveProps(this, nextProps, nextContext, forceReattachListeners);
    } catch (error) {
      const finalError = wrapError(error,
          new Error(`During ${this.debugId()})\n .componentWillReceiveProps(), with:`),
          "\n\tuiContext:", this.state.uiContext,
          "\n\tstate:", this.state,
          "\n\tprops:", this.props,
          "\n\tnextProps:", nextProps,
      );
      outputError(finalError, "Exception caught in UIComponent.componentWillReceiveProps");
      this.enableError(finalError);
    }
  }

  shouldComponentUpdate (nextProps: Object, nextState: Object, nextContext: Object): boolean {
    try {
      return _shouldComponentUpdate(this, nextProps, nextState, nextContext);
    } catch (error) {
      const finalError = wrapError(error,
          new Error(`During ${this.debugId()})\n .shouldComponentUpdate(), with:`),
          "\n\tprops:", this.props,
          "\n\tnextProps:", nextProps,
          "\n\tstate:", this.state,
          "\n\tnextState:", nextState,
          "\n\tcontext:", this.context,
          "\n\tnextContext:", nextContext,
      );
      outputError(finalError, "Exception caught in UIComponent.shouldComponentUpdate");
      this.enableError(finalError);
    }
    return true;
  }

  componentWillUnmount () {
    try {
      _componentWillUnmount(this);
    } catch (error) {
      const finalError = wrapError(error,
          new Error(`During ${this.debugId()})\n .componentWillUnmount(), with:`),
          "\n\tprops:", this.props,
          "\n\tstate:", this.state,
          "\n\tcontext:", this.context,
      );
      outputError(finalError, "Exception caught in UIComponent.componentWillUnmount");
    }
  }

  setState (newState: any, callback: any) {
    if (this._isMounted) super.setState(newState, callback);
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

  getValos () { return this.context.engine.getRootScope().valos; }

  getStyle () {
    return Object.assign({},
        (this.constructor._defaultPresentation().root || {}).style || {},
        this.style || {},
        this.props.style || {});
  }

  static propsCompareModesOnComponentUpdate = {
    _presentation: "ignore",
    reactComponent: "ignore",
  }

  /**
   * Returns the current focus of this UI component or throws if this component is disabled.
   */
  getFocus (state: Object = this.state) {
    const ret = this.tryFocus(state);
    invariantify(typeof ret !== "undefined", `${this.constructor.name
        }.getFocus() called when component is disabled (focus/head is undefined)`);
    return ret;
  }

  tryFocus (state: Object = this.state) {
    const ret = getScopeValue(state.uiContext, "focus");
    return (typeof ret !== "undefined")
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
    return this.props.elementKey || this.getUIContextValue("key");
  }

  _subscriptions: Object;
  style: Object;

  rawPresentation () {
    return this.props._presentation || this.constructor._defaultPresentation();
  }

  // Returns a fully expanded presentation map or entry at componentPath
  presentation (componentPath: any, { initial, extraContext = {}, baseContext }:
      { initial?: Object, extraContext?: Object, baseContext?: Object } = {}) {
    return presentationExpander(
        this,
        componentPath,
        initial || { key: `-${componentPath}>` },
        extraContext,
        baseContext || this.getUIContext());
  }

  /**
   * Returns comprehensive props for a child element. Fetches and expands the presentation using
   * given 'name', as per presentation, using scope as extra context
   *
   * Includes:
   * key (generated)
   * head ()
   * scope ()
   * kuery (null)
   *
   * @param {any} name
   * @param {any} { index, head, kuery }
   */
  childProps (name: string, options:
      { index?: any, kuery?: Kuery, head?: any, focus?: any, context?: Object } = {},
      initialProps: Object = this.presentation(name, { extraContext: options.context })) {
    try {
      return _childProps(this, name, options, initialProps);
    } catch (error) {
      throw wrapError(error, `During ${this.debugId()}\n .childProps(${name}), with:`,
          "\n\toptions:", options,
          "\n\tkey:", options.context && options.context.key,
          "\n\tprops:", this.props,
          "\n\tstate:", this.state,
          "\n\trawPresentation:", this.rawPresentation());
    }
  }

  debugId (options: ?Object) {
    const keyString = this.getUIContext() && this.getUIContext().hasOwnProperty("key") // eslint-disable-line
            ? `key: '${this.getUIContext().key}'`
        : (this.props.context && this.props.context.key)
            ? `key: '${this.props.context.key}'`
        : ((this.state || {}).uiContext || {}).key
            ? `key: '${this.state.uiContext.key}'`
        : "no key";
    let focus = this.getUIContextValue("focus");
    if (typeof focus === "undefined") focus = this.getUIContextValue("head");
    return `<${this.constructor.name} key="${keyString}" focus={${
        Array.isArray(focus)
            ? `[${focus.map(entry => debugId(entry, { short: true, ...options })).join(", ")}]`
            : debugId(focus, { short: true, ...options })
    }} ... />`;
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
   *     starts from this.getFocus(), goes to focus.get("editTarget"),
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
  }

  unbindSubscriptions (/* focus: ?Vrapper */) {
    return _finalizeUnbindSubscriptions(this);
  }

  _isMounted: boolean;
  _areSubscriptionsBound: ?boolean;

  // Helpers

  _errorObject: ?any;

  enableError = (error: string | Error) => _enableError(this, error)
  toggleError = () => _toggleError(this)
  clearError = () => _clearError(this)

  // defaults to lens itself
  renderLens (lens: any, focus?: any, lensName: string, onlyIfAble?: boolean, onlyOnce?: boolean):
      null | string | React.Element<any> | [] | Promise<any> {
    const ret = this.tryRenderLens(lens, focus, lensName, onlyIfAble, onlyOnce);
    return (ret !== undefined) ? ret : lens;
  }

  tryRenderLens (lens: any, focus: any = this.tryFocus(), lensName: string, onlyIfAble?: boolean,
      onlyOnce?: boolean): void | null | string | React.Element<any> | [] | Promise<any> {
    const lensAssembly = this.getUIContextValue(this.getValos().Lens.lensAssembly) || [];
    const assemblyLength = lensAssembly.length;
    let ret;
    try {
      lensAssembly.push(lensName);
      return (ret = _tryRenderLens(this, lens, focus, lensName, onlyIfAble, onlyOnce));
    } catch (error) {
      throw wrapError(error, `During ${this.debugId()}\n .renderLens, with:`,
          "\n\tlensName:", lensName,
          "\n\tlens:", lens,
          "\n\ttypeof lens:", typeof lens,
          "\n\tfocus:", ...dumpObject(focus));
    } finally {
      if (ret === null) lensAssembly.splice(assemblyLength);
      // else lensAssembly[assemblyLength] = { [lensName]: ret };
    }
  }

  // defaults to arrayFromAny(sequence)
  renderLensSequence (sequence: any, focus: any = this.tryFocus()):
      [] | Promise<any[]> {
    const array = arrayFromAny(sequence !== null ? sequence : undefined);
    const ret = _tryRenderLensArray(this, array, focus);
    return (typeof ret !== "undefined") ? ret
        : array;
  }

  tryRenderLensSequence (sequence: any, focus: any = this.tryFocus()):
      void | [] | Promise<any[]> {
    return _tryRenderLensArray(this, arrayFromAny(sequence), focus);
  }

  renderLoaded (focus: any):
      null | string | React.Element<any> | [] | Promise<any> {
    return _renderFocus(this, focus);
  }

  renderFocusAsSequence (foci: any[], EntryElement: Object = UIComponent, entryProps: Object = {},
      keyFromFocus?: (focus: any, index: number) => string
  ): [] {
    return _renderFocusAsSequence(this, foci, EntryElement, entryProps, keyFromFocus);
  }

  // defaults to null
  renderSlotAsLens (slot: string | Symbol, focus: any, rootSlotName?: string,
      onlyIfAble?: boolean, onlyOnce?: boolean):
          null | string | React.Element<any> | [] | Promise<any> {
    const ret = this.tryRenderSlotAsLens(slot, focus, rootSlotName, onlyIfAble, onlyOnce);
    return (ret !== undefined) ? ret : null;
  }

  renderFirstEnabledDelegate (delegates: any[], focus: any = this.tryFocus(), lensName: string):
      null | string | React.Element<any> | [] | Promise<any> {
    return _renderFirstAbleDelegate(this, delegates, focus, lensName);
  }

  tryRenderSlotAsLens (slot: string | Symbol, focus: any = this.tryFocus(),
      rootSlotName_?: string, onlyIfAble?: boolean, onlyOnce?: boolean):
          void | null | string | React.Element<any> | [] | Promise<any> {
    const valosLens = this.getValos().Lens;
    let slotValue, ret; // eslint-disable-line
    const slotName = typeof slot === "string" ? slot : valosLens[slot];
    const slotSymbol = typeof slot !== "string" ? slot : valosLens[slot];
    const rootSlotName = rootSlotName_ || slotName;
    try {
      if (!slotSymbol) throw new Error(`No valos.Lens slot symbol for '${slotName}'`);
      if (!slotName) throw new Error(`No valos.Lens slot name for '${String(slotSymbol)}'`);
      slotValue = _readSlotValue(this, slotName, slotSymbol, focus, onlyIfAble);
      ret = slotValue && this.renderLens(slotValue, focus, rootSlotName, undefined, onlyOnce);
      return ret;
    } catch (error) {
      throw wrapError(error, `During ${this.debugId()}\n .renderSlotAsLens(${
              slotName || String(slotSymbol)}), with:`,
          "\n\tfocus:", focus,
          "\n\tslot value:", slotValue,
          "\n\trootSlotName:", rootSlotName);
    }
  }

  static thirdPassErrorElement =
      <div>Error caught while rendering error, see console for more details</div>;

  enqueueRerenderIfPromise (maybePromise: any | Promise) {
    if (!isPromise(maybePromise)) return false;
    return maybePromise.then(renderValue => {
      this._pendingRenderValue = renderValue;
      this.forceUpdate();
    });
  }

  render (): null | string | React.Element<any> | [] {
    let firstPassError;
    let ret = this._pendingRenderValue;
    this._pendingRenderValue = undefined;
    let mainValidationFaults;
    let latestRenderedLensSlot;
    if (this.state.uiContext) this.setUIContextValue(this.getValos().Lens.lensAssembly, []);
    try {
      const renderNormally = (ret === undefined) && !this._errorObject
          && !_checkForInfiniteRenderRecursion(this);
      if (renderNormally) {
        // TODO(iridian): Fix this uggo hack where ui-context content is updated at render.
        if (this.props.hasOwnProperty("styleSheet")) {
          this.setUIContextValue(VSSStyleSheetSymbol, this.props.styleSheet);
        } else {
          this.clearUIContextValue(VSSStyleSheetSymbol);
        }
        try {
          // Render the main lens delegate sequence.
          latestRenderedLensSlot = this.constructor.mainLensSlotName;
          ret = this.tryRenderSlotAsLens(latestRenderedLensSlot);
        } catch (error) {
          // Try to connect to missing partitions.
          if (!tryConnectToMissingPartitionsAndThen(error, () => this.forceUpdate())) {
            throw error;
          }
          latestRenderedLensSlot = "pendingConnectionsLens";
          ret = this.tryRenderSlotAsLens(latestRenderedLensSlot,
              (error.originalError || error).missingPartitions.map(entry => String(entry)));
        }
        // Try to handle pending promises.
        const rerenderPromise = this.enqueueRerenderIfPromise(ret);
        if (rerenderPromise) {
          const operationInfo = ret.operationInfo || {
            slotName: "pendingLens", focus: { render: ret },
            onError: { slotName: "failedLens", lens: { render: ret } },
          };
          rerenderPromise.catch(error => {
            if (operationInfo.onError) Object.assign(error, operationInfo.onError);
            const wrappedError = wrapError(error,
              new Error(`During ${this.debugId()}\n .render().result.catch`),
                  "\n\tuiContext:", this.state.uiContext,
                  "\n\tfocus:", this.tryFocus(),
                  "\n\tstate:", this.state,
                  "\n\tprops:", this.props,
            );
            outputError(wrappedError, "Exception caught in UIComponent.render.result.catch");
            this.enableError(wrappedError);
          });
          latestRenderedLensSlot = operationInfo.slotName;
          ret = this.tryRenderSlotAsLens(latestRenderedLensSlot, operationInfo.focus);
          if (isPromise(ret)) {
            throw wrapError(new Error("Invalid render result: 'pendingLens' returned a promise"),
                new Error(`During ${this.debugId()}\n .render().ret.pendingLens, with:`),
                "\n\tpendingLens ret:", dumpObject(ret),
                "\n\tcomponent:", dumpObject(this));
          }
        }

        if (ret === undefined) return null;
        mainValidationFaults = _validateElement(this, ret);

        // Main return line
        if (mainValidationFaults === undefined) return ret;

        console.error(`Validation faults on render result of '${latestRenderedLensSlot}' by`,
                this.debugId(),
            "\n\tfaults:", mainValidationFaults,
            "\n\tcomponent:", this,
            "\n\tfailing render result:", ret);
        ret = this.renderSlotAsLens("invalidElementLens",
            "see console log for 'Validation faults' details");
      }
    } catch (error) {
      firstPassError = error;
    }

    let internalErrorValidationFaults;
    try {
      if (firstPassError) {
        const wrappedError = wrapError(firstPassError,
            new Error(`During ${this.debugId()}\n .render()`),
            "\n\tuiContext:", this.state.uiContext,
            "\n\tfocus:", this.tryFocus(),
            "\n\tstate:", this.state,
            "\n\tprops:", this.props,
        );
        outputError(wrappedError, "Exception caught in UIComponent.render");
        this.enableError(wrappedError);
      }
      if (ret === undefined) {
        const errorObject = this._errorObject || "<render result undefined>";
        const errorSlotName = errorObject.slotName || "internalErrorLens";
        const failure: any = this.renderSlotAsLens(errorSlotName, errorObject);
        if (isPromise(failure)) throw new Error(`${errorSlotName} returned a promise`);
        ret = failure;
        let isSticky = errorObject.isSticky;
        if (isSticky === undefined) {
          const engine = this.context.engine;
          const errorDescriptor = engine.getHostObjectDescriptor(
              engine.getRootScope().valos.Lens[errorSlotName]);
          isSticky = (errorDescriptor || {}).isStickyError;
        }
        if (!isSticky) {
          Promise.resolve(true).then(() => { this._errorObject = undefined; });
        }
      }
      internalErrorValidationFaults = _validateElement(this, ret);
      if (internalErrorValidationFaults) {
        throw new Error("Error rendering itself contains validation faults");
      }
    } catch (secondPassError) {
      // Exercise in defensive programming. We should never get here, really,, but there's nothing
      // more infurating and factually blocking for the user than react white screen of death.
      // Of all react hooks .render() is most vulnerable to these from user actions, so we fall back
      // to simpler error messages to deny exceptions from leaving while still trying to provide
      // useful feedback for diagnostics & debugging purposes.
      try {
        outputError(wrapError(secondPassError,
            `INTERNAL ERROR: Exception caught in ${this.constructor.name
                }.render() second pass,`,
            ...(!internalErrorValidationFaults ? []
                : ["\n\terror contains validation faults:", internalErrorValidationFaults]
            ),
            ...(firstPassError
                    ? ["\n\twhile rendering firstPassError:", firstPassError]
                : this._errorObject
                    ? ["\n\twhile rendering existing error status:", this._errorObject]
                : ["\n\twhile rendering main render validation fault:", mainValidationFaults]
            ),
            "\n\tin component:", this));
        ret = (
          <div>
            Exception caught while trying to render error:
            {String(secondPassError)}, see console for more details
          </div>
        );
      } catch (thirdPassError) {
        try {
          console.error("INTERNAL ERROR: Exception caught on render() third pass:", thirdPassError,
              "\n\twhile rendering secondPassError:", secondPassError,
              "\n\tfirstPassError:", firstPassError,
              "\n\texisting error:", this._errorObject,
              "\n\tin component:", this);
          ret = UIComponent.thirdPassErrorElement;
        } catch (fourthPassError) {
          console.warn("INTERNAL ERROR: Exception caught on render() fourth pass:", fourthPassError,
              "\n\tGiving up, rendering null. You get candy if you ever genuinely encounter this.");
          ret = null;
        }
      }
    }
    return ret;
  }
}
