// @flow

import React from "react";
import PropTypes from "prop-types";

import { tryConnectToAbsentChroniclesAndThen } from "~/raem/tools/denormalized/partitions";

import Vrapper, { Subscription, LiveUpdate } from "~/engine/Vrapper";
import debugId from "~/engine/debugId";
import { dumpKuery, dumpObject } from "~/engine/VALEK";

import Lens from "~/inspire/valosheath/valos/Lens";

import { arrayFromAny, invariantify, isPromise, outputError, wrapError }
    from "~/tools";

import { clearScopeValue, getScopeValue, setScopeValue } from "./scopeValue";

import {
  _enableError, _toggleError, _clearError,
} from "./_errorOps";
import {
  _componentConstructed, _componentWillReceiveProps, _shouldComponentUpdate, _componentWillUnmount,
} from "./_lifetimeOps";
import {
  // _childProps,
  _checkForInfiniteRenderRecursion,
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

    style: PropTypes.object,

    // kuery: PropTypes.instanceOf(Kuery),
    // head: PropTypes.any, // obsolete alias for focus.

    delegate: PropTypes.arrayOf(PropTypes.any),

    loadingLens: PropTypes.any,
    loadingFailedLens: PropTypes.any,

    pendingLens: PropTypes.any,
    failedLens: PropTypes.any,

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
    activatingLens: PropTypes.any,
    inactiveLens: PropTypes.any,
    unavailableLens: PropTypes.any,
    destroyedLens: PropTypes.any,

    lensProperty: _propertyNames,
    focusLensProperty: _propertyNames,
    delegateLensProperty: _propertyNames,
    instanceLensProperty: _propertyNames,

    pendingFocusLens: PropTypes.any,

    kueryingPropsLens: PropTypes.any,
    pendingPropsLens: PropTypes.any,
    failedPropsLens: PropTypes.any,

    pendingChildrenLens: PropTypes.any,
    failedChildrenLens: PropTypes.any,
    lensPropertyNotFoundLens: PropTypes.any,
  }

  static childContextTypes = {
    parentUIContext: PropTypes.object,
  };

  static valensPropsBehaviors = {
    children: false,
  }

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
    uiContext[Lens.currentRenderDepth] = context.parentUIContext[Lens.currentRenderDepth] + 1;

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
      return _shouldComponentUpdate(this, nextProps, nextState, nextContext);
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

  // getValos () { return this.context.engine.getRootScope().valos; }

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

  _errorObject: ?any;

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

  renderFocusAsSequence (foci: any[], EntryElement: Object = UIComponent, entryProps: Object,
      entryChildren: ?Array,
      keyFromFocus: (focus: any, index: number) => string,
      renderRejection: ?(focus: any, index: number) => undefined | any,
      onlyPostRender: ?Boolean,
  ): [] {
    return _renderFocusAsSequence(this, foci, EntryElement, entryProps, entryChildren,
        keyFromFocus
            || ((focus, index) => ((focus instanceof Vrapper)
                ? `${focus.getBriefUnstableId()}<-${this.getKey() || "-"}`
                : `[${index}]${this.getKey() || "-"}`)),
        renderRejection,
        onlyPostRender);
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

  render (): null | string | React.Element<any> | [] {
    let firstPassError;
    let ret = this._pendingRenderValue;
    this._pendingRenderValue = undefined;
    let mainValidationFaults;
    let latestRenderedLensSlot;
    if (this.state.uiContext) this.setUIContextValue(Lens.slotAssembly, []);
    try {
      const renderNormally = (ret === undefined)
          && !this._errorObject
          && !_checkForInfiniteRenderRecursion(this);
      if (renderNormally) {
        // TODO(iridian): Fix this uggo hack where ui-context content is updated at render.
        try {
          // Render the main lens delegate sequence.
          latestRenderedLensSlot = this.constructor.mainLensSlotName;
          ret = this.tryRenderSlotAsLens(latestRenderedLensSlot);
        } catch (error) {
          // Try to connect to absent chronicles.
          if (!tryConnectToAbsentChroniclesAndThen(error, () => this.forceUpdate())) {
            throw error;
          }
          latestRenderedLensSlot = "pendingConnectionsLens";
          ret = this.tryRenderSlotAsLens(latestRenderedLensSlot,
              (error.originalError || error).absentChronicleURIs.map(entry => String(entry)));
        }
        // Try to handle pending promises.
        if (isPromise(ret)) {
          const operationInfo = ret.operationInfo || {
            slotName: "pendingLens", focus: { render: ret, latestRenderedLensSlot },
            onError: { slotName: "failedLens", lens: { render: ret } },
          };
          ret.then(renderValue => {
            this._pendingRenderValue = renderValue;
            this.forceUpdate();
          }).catch(error => {
            if (operationInfo.onError) Object.assign(error, operationInfo.onError);
            this.enableError(wrapError(error,
                    new Error(`During ${this.debugId()}\n .render().result.catch`),
                    "\n\tuiContext:", this.state.uiContext,
                    "\n\tfocus:", this.tryFocus(),
                    "\n\tstate:", this.state,
                    "\n\tprops:", this.props,
                ), "UIComponent.render.result.catch");
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
        mainValidationFaults = _validateElement(ret);

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
        this.enableError(wrapError(firstPassError,
                new Error(`During ${this.debugId()}\n .render()`),
                "\n\tuiContext:", this.state.uiContext,
                "\n\tfocus:", this.tryFocus(),
                "\n\tstate:", this.state,
                "\n\tprops:", this.props,
            ), "Exception caught in UIComponent.render");
      }
      if (ret === undefined) {
        const errorObject = this._errorObject || "<render result undefined>";
        const errorSlotName = errorObject.slotName || "internalErrorLens";
        const failure: any = this.renderSlotAsLens(errorSlotName, errorObject);
        if (isPromise(failure)) throw new Error(`${errorSlotName} returned a promise`);
        ret = failure;
        let isSticky = errorObject.isSticky;
        if (isSticky === undefined) {
          isSticky = (this.context.engine.getHostObjectDescriptor(Lens[errorSlotName]) || {})
              .isStickyError;
        }
        if (!isSticky) {
          Promise.resolve(true).then(() => { this._errorObject = undefined; });
        }
      }
      internalErrorValidationFaults = _validateElement(ret);
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
              "\n\tGiving up, rendering null.",
              "\n\tYou can ask iridian for candy if you ever genuinely encounter this.");
          ret = null;
        }
      }
    }
    return ret;
  }
}
