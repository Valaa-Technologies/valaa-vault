// @flow

import React from "react";
import PropTypes from "prop-types";

import { tryConnectToAbsentChroniclesAndThen } from "~/raem/tools/denormalized/partitions";
import { Kuery } from "~/raem/VALK";

import Vrapper, { LiveUpdate, getImplicitCallable } from "~/engine/Vrapper";
import VALEK, { IsLiveTag } from "~/engine/VALEK";
import getImplicitMediaInterpretation from "~/engine/Vrapper/getImplicitMediaInterpretation";

import Valoscope from "~/inspire/ui/Valoscope";
import UIComponent from "~/inspire/ui/UIComponent";

import {
  arrayFromAny, patchWith, dumpObject, isPromise, thisChainEagerly, thisChainReturn, wrapError,
} from "~/tools";

import { tryCreateLivePropsArgs, LivePropsPropsTag, postRenderElement } from "./_livePropsOps";
import { createDynamicKey } from "./_propsOps";

export { tryCreateLivePropsArgs, LivePropsPropsTag };

const _isReservedPropsName = {
  key: true,
  hierarchyKey: true,
  globalId: true,
  children: true,
  style: true,
  styleSheet: true,
  focus: true,
  array: true,
  frame: true,
  context: true,
  className: true,
  lens: true,
  lensProperty: true,
  focusLensProperty: true,
  delegateLensProperty: true,
  instanceLensProperty: true,
  instanceLensPrototype: true,
  // all names which begin with "on" and are followed by an uppercase letter
  // all names which end with "Lens"
};

/* eslint-disable react/prop-types, complexity */

/**
 * An UIComponent which wraps another element of given
 * props.elementType and manages its live props.
 *
 * Live props are passed into LiveProps through props.propsKueriesSeq
 * (an array of kuery key - live kuery pairs). LiveProps keeps track of these
 * kueries (valked from parentUIContext.focus) and maintains their
 * current values in corresponding map of kuery key to current value.
 *
 * When rendering the element, props.elementPropsSeq are pre-processed and
 * props values which are callback functions will be called with the
 * live value map and the return values used as the final
 * prop value that is passed to the element. This roughly mimics
 * following JSX:
 *
 * <props.elementType {...processedProps}>{this.props.children}</props.elementType>
 *
 * The element can be any element, even another UIComponent; however
 * such an UIComponent won't receive any special treatment and will
 * need to receive its props through props.elementPropsSeq.
 *
 * Note: as LiveProps is an UIComponent it can be passed the normal
 * UIComponent props like props.parentUIContext: however the resulting
 * local uiContext.focus will not
 * affect the live props and is only used for the children (if any).
 *
 * @export
 * @class LiveProps
 * @extends {UIComponent}
 */
export default class LiveProps extends UIComponent {
  static mainLensSlotName = "livePropsLens";

  static propTypes = {
    ...UIComponent.propTypes,
    hierarchyKey: PropTypes.string,
    elementType: PropTypes.any.isRequired,
    elementPropsSeq: PropTypes.arrayOf(PropTypes.any).isRequired,
    propsKueriesSeq: PropTypes.arrayOf(PropTypes.any),
    onRef: PropTypes.instanceOf(Kuery),
  }
  static livePropsBehaviors = {
    ...UIComponent.livePropsBehaviors,
    propsKueriesSeq: false,
    onRef: false,
  }

  getKey () {
    return this.props.globalId || this.props.hierarchyKey
        || this.context.parentUIContext.reactComponent.getKey();
  }

  bindFocusSubscriptions (focus: any, props: Object) {
    super.bindFocusSubscriptions(focus, props);
    // Live props are always based on the parent focus.
    const live = _createStateLive(this, props);
    const kueryStates = {};
    for (const [kueryName, kuery] of (props.propsKueriesSeq || [])) {
      const propState = kueryStates[kueryName] = Object.create(live);
      propState.kueryName = kueryName;
      propState.kuery = kuery;
      thisChainEagerly(propState, this.getUIContext(),
          (kuery[IsLiveTag] === false)
              ? _staticKueryPropChain
              : _liveKueryPropChain,
          _errorOnBindFocusSubscriptions);
    }
    _initializeElementPropsToLive(this, live, kueryStates);
    // stateLive.ongoingKueries = _refreshOngoingKueries(
    //    this, immediateKueryValues, Object.keys(props.propsKueriesSeq));
    this.setState({ live });
    return false;
  }

  unbindSubscriptions () {
    super.unbindSubscriptions();
    this.state.live.isUnbound = true;
  }

  shouldComponentUpdate (nextProps: Object, nextState: Object) {
    if (nextState.live !== this.state.live) return true;
    if (nextProps !== this.props) return true;
    return false;
  }

  UNSAFE_componentWillReceiveProps (nextProps: Object, nextContext: Object) { // eslint-disable-line
    super.UNSAFE_componentWillReceiveProps(nextProps, nextContext,
        nextProps.propsKueriesSeq !== this.props.propsKueriesSeq);
  }

  _currentSheetContent: ?Object;
  _currentSheetObject: ?Object;

  readSlotValue (slotName: string, slotSymbol: Symbol, focus: any, onlyIfAble?: boolean) {
    // Use the props slots of the parent component because LiveProps
    // cannot be explicitly passed any props.
    // These slot props should probably be passed to LiveProps inside props, though...
    return super.readSlotValue(slotName, slotSymbol, focus, onlyIfAble,
        ((this.context.parentUIContext || {}).reactComponent || this).props);
  }

  renderLoaded (focus: any) {
    const stateLive = this.state.live;
    if (!stateLive) return this.renderSlotAsLens("loadingLens");
    /*
    if (stateLive.ongoingKueries) {
      return this.renderSlotAsLens("kueryingPropsLens", stateLive.ongoingKueries);
    }
    */

    if (stateLive.delegate !== undefined) {
      return this.renderFirstEnabledDelegate(stateLive.delegate, undefined, "delegate");
    }
    const pendingPropNames = stateLive.pendingProps && _refreshPendingProps(stateLive);
    if (pendingPropNames) {
      return this.renderSlotAsLens("pendingPropsLens", pendingPropNames);
    }

    let finalType = this.props.elementType;
    let children = arrayFromAny(this.props.children);
    if (stateLive.outerProps) {
      finalType = Valoscope;
      children = [React.createElement(this.props.elementType, stateLive.innerProps, ...children)];
    }

    /* Only enable this section for debugging React key warnings; it will break react elsewhere
    if (elementType === Valoscope) {
      elementType = class DebugValoscope extends Valoscope {};
      Object.defineProperty(elementType, "name", {
        value: `Valoscope_${innerProps.className || ""}${this.getKey()}`,
      });
    }
    /* */
    const finalProps = stateLive.outerProps || stateLive.innerProps;
    const createKey = (typeof finalProps.key === "function" ? finalProps.key : createDynamicKey);
    if (stateLive.array) {
      if (!Array.isArray(stateLive.array)) {
        return this.renderSlotAsLens("arrayNotIterableLens", stateLive.array);
      }
      if (children.length) finalProps.children = children;
      return this.renderFocusAsSequence(stateLive.array, finalType, finalProps, createKey);
    }
    if (typeof finalProps.key !== "string") finalProps.key = createKey(focus);
    return postRenderElement(this, React.createElement(finalType, finalProps, ...children), focus);
  }
}

function _createStateLive (component, props) {
  return {
    component,
    isValoscope: props.elementType === Valoscope,
    frame: component.getUIContextValue("frame") || {},
    kueryValues: {},
    pendingProps: null,
    innerProps: {},
  };
}

const _liveKueryPropChain = [
  function _bindRepeathenableLiveKuery (scope) {
    return this.component.bindLiveKuery(this.kueryName, this.frame, this.kuery,
            { asRepeathenable: true, scope });
  },
  function _extractLiveUpdateValue (liveUpdate: LiveUpdate) {
    return [liveUpdate.value()];
  },
  _registerUpdatedKueryValue,
];

const _staticKueryPropChain = [
  function _runImmediateKuery (scope) {
    return [(this.frame instanceof Vrapper)
        ? this.frame.step(this.kuery, { scope })
        : this.component.context.engine.run(this.frame, this.kuery, { scope })];
  },
  _registerUpdatedKueryValue,
];

function _registerUpdatedKueryValue (kueryValue) {
  if (this.isUnbound) return thisChainReturn(false); // return false to detach subscription
  const kueryValues = this.kueryValues;
  const previousValue = kueryValues[this.kueryName];
  kueryValues[this.kueryName] = kueryValue;
  // no dependentProps means initial binding phase
  if (!this.dependentProps || (previousValue === kueryValue)) return undefined;
  for (const [propName, propFetcher] of this.dependentProps) {
    _registerNewElementPropValue(this.component, this, propName, propFetcher(kueryValues));
  }
  this.component.forceUpdate();
  return undefined;
}

function _errorOnBindFocusSubscriptions (error) {
  this.component.enableError(wrapError(error,
          new Error(`_liveKueryPropChain('${this.kueryName}')`),
          "\n\tuiContext:", ...dumpObject(this.component.state.uiContext),
          "\n\tfocus:", ...dumpObject(this.component.tryFocus()),
          "\n\tkuery:", ...dumpObject(this.kuery),
          "\n\tstate:", ...dumpObject(this.component.state),
          "\n\tprops:", ...dumpObject(this.component.props)),
      `Exception caught during LiveProps._liveKueryPropChain('${this.kueryName}')`);
}

function _initializeElementPropsToLive (component, stateLive, kueryStates) {
  const kueryValues = stateLive.kueryValues;
  for (const [propName, propValue] of component.props.elementPropsSeq) {
    let newValue = propValue;
    if ((typeof newValue === "function") && newValue.fetchedKueryNames) {
      let isPending;
      for (const kueryName of newValue.fetchedKueryNames) {
        if (!kueryValues.hasOwnProperty(kueryName)) isPending = true;
        (kueryStates[kueryName].dependentProps || (kueryStates[kueryName].dependentProps = []))
            .push([propName, newValue]);
      }
      if (isPending) {
        (stateLive.pendingProps || (stateLive.pendingProps = []))
            .push([propName, newValue.fetchedKueryNames]);
        continue;
      }
      newValue = newValue(kueryValues);
    }
    _registerNewElementPropValue(component, stateLive, propName, newValue);
  }
}

function _registerNewElementPropValue (component, stateLive, propName, propValue) {
  try {
    let newValue = propValue;
    if (isPromise(newValue)) {
      throw new Error("INTERNAL ERROR: _registerNewElementPropValue should never see promises");
    }
    let newName = propName;
    if (newName[0] === "$") {
      const index = newName.indexOf(".");
      if (index === -1) {
        throw new Error(`$-prefixed attribute is missing a '.'-separator: '${newName}'`);
      }
      const namespace = newName.slice(1, index);
      const name = newName.slice(index + 1);
      if (namespace === "context") {
        component.state.uiContext[name] = newValue;
        return;
      }
      if (namespace === "lens") {
        if (!stateLive.isValoscope) {
          (stateLive.outerProps || (stateLive.outerProps = {}))[name] = newValue;
          return;
        }
        newName = name;
      } else if (namespace === "on") {
        if (name === "ref") {
          newName = "ref";
        } else {
          throw new Error(`Unrecognized 'on'-namespace callback attribute: '${newName}'`);
        }
        if (typeof newValue !== "function") {
          newValue = getImplicitCallable(
              newValue, `props.on:${newName}`, { synchronous: undefined });
        }
      } else {
        throw new Error(`Unrecognized namespace '${namespace}' in attribute '${newName}'`);
      }
    } else if (!_isReservedPropsName[newName]) {
      if (newName.startsWith("on")
          && (!stateLive.isValoscope || (newName[2] === newName[2].toUpperCase()))) {
        if (typeof newValue !== "function") {
          newValue = getImplicitCallable(
              newValue, `props.${newName}`, { synchronous: undefined });
        }
        if (newName === "onRef") {
          newName = "ref";
        }
      }
      if (typeof newValue === "function") {
        newValue = _wrapInValOSExceptionProcessor(component, newValue, newName);
      }
    } else if (newName === "context") {
      Object.assign(component.state.uiContext, newValue);
      return;
    } else if ((newName === "class") || (newName === "className")) {
      if (!stateLive.isValoscope) newName = "className";
      newValue = _refreshClassName(component, focus, newValue);
    } else if (newName === "delegate") {
      if (component.props.elementPropsSeq.length === 1) {
        stateLive.delegate = newValue;
        return;
      }
    } else if (newName === "valoscope" || newName === "vScope" || newName === "valaaScope") {
      Object.assign(stateLive.isValoscope
              ? stateLive.innerProps
              : stateLive.outerProps || (stateLive.outerProps = {}),
          newValue || {});
      return;
    } else if (newName === "array") {
      // elementType.isUIComponent; ???
      stateLive.array = !Array.isArray(newValue)
              && (typeof newValue[Symbol.iterator] === "function")
          ? [...newValue]
          : newValue;
      return;
    }
    stateLive.innerProps[newName] = newValue;
  } catch (error) {
    throw wrapError(error, new Error(`_registerNewElementPropValue('${propName}')`),
        "\n\tvalue:", ...dumpObject(propValue),
        "\n\tstateLive:", ...dumpObject(stateLive),
        "\n\tcomponent:", ...dumpObject(component));
  }
}


function _refreshPendingProps (stateLive) {
  const kueryValues = stateLive.kueryValues;
  stateLive.pendingProps = stateLive.pendingProps.filter(([, fetchedKueryNames]) => {
    for (const kueryName of fetchedKueryNames) {
      if (!kueryValues.hasOwnProperty(kueryName)) return true;
    }
    return false;
  });
  if (stateLive.pendingProps.length) return stateLive.pendingProps.map(([name]) => name);
  stateLive.pendingProps = null;
  return undefined;
}

function _refreshClassName (component, focus, value) {
  if ((value == null) || !(value instanceof Vrapper)) return value;
  const bindingSlot = `props_className_content`;
  if (value.hasInterface("Media") && !component.getBoundSubscription(bindingSlot)) {
    component.bindLiveKuery(bindingSlot, value, VALEK.toMediaContentField(), {
      onUpdate: function updateClassContent () {
        if (component.tryFocus() !== focus) return false;
        return component.forceUpdate() || undefined;
      },
      updateImmediately: false,
    });
  }
  const sheetContent = getImplicitMediaInterpretation(value, bindingSlot, {
    fallbackContentType: "text/css",
    synchronous: undefined,
    discourse: component.context.engine.discourse,
  });
  if ((sheetContent == null) || isPromise(sheetContent)) return sheetContent;
  if (component._currentSheetContent !== sheetContent) {
    if (component._currentSheetContent) component.context.releaseVssSheets(component);
    component._currentSheetContent = sheetContent;
    const sheet = {};
    if (sheetContent.html) patchWith(sheet, sheetContent.html);
    if (sheetContent.body) patchWith(sheet, sheetContent.body);
    for (const [selector, styles] of Object.entries(sheetContent)) {
      if ((selector !== "body") && (selector !== "html")) {
        sheet[`& .${selector}`] = styles;
      }
    }
    component._currentSheetObject = component.context.getVSSSheet({ sheet }, component);
  }
  return component._currentSheetObject.classes.sheet;
}

function _wrapInValOSExceptionProcessor (component: LiveProps, callback: Function, name: string) {
  const ret = function handleCallbackExceptions (...args: any[]) {
    try {
      return callback.call(this, ...args);
    } catch (error) {
      const absentChronicleSourcings = tryConnectToAbsentChroniclesAndThen(error,
          () => handleCallbackExceptions(...args));
      if (absentChronicleSourcings) return absentChronicleSourcings;
      const finalError = wrapError(error,
          new Error(`props.${name} valospace callback`),
          "\n\targs:", args,
          "\n\tcontext:", ...dumpObject(component.state.uiContext),
          "\n\tcomponent:", ...dumpObject(component),
      );
      component.enableError(finalError,
          "Exception caught during LiveProps.handleCallbackExceptions");
    }
    return undefined;
  };
  Object.defineProperty(ret, "name", { value: `handleExceptionsOf_${name}` });
  return ret;
}
