// @flow

import React from "react";
import PropTypes from "prop-types";

import { tryConnectToAbsentChroniclesAndThen } from "~/raem/tools/denormalized/partitions";
import { SourceInfoTag } from "~/raem/VALK/StackTrace";

import Vrapper, { LiveUpdate, getImplicitCallable } from "~/engine/Vrapper";
import VALEK, { IsLiveTag, toVAKONTag } from "~/engine/VALEK";
import getImplicitMediaInterpretation from "~/engine/Vrapper/getImplicitMediaInterpretation";

import Valoscope from "~/inspire/ui/Valoscope";
import UIComponent from "~/inspire/ui/UIComponent";
import Lens from "~/inspire/valosheath/valos/Lens";

import {
  patchWith, dumpObject, isPromise, thisChainEagerly, thisChainReturn, wrapError
} from "~/tools";

import { createDynamicKey } from "./_propsOps";
import { VSSStyleSheetSymbol } from "./_styleOps";
import { tryCreateValensArgs, ValensPropsTag, postRenderElement } from "./_valensOps";

export { tryCreateValensArgs, ValensPropsTag };

/* eslint-disable react/prop-types, complexity */

/**
 * An UIComponent which wraps another element of given
 * props.elementType and manages its live props.
 *
 * Live props are passed into Valens through props.propsKueriesSeq
 * (an array of kuery key - live kuery pairs). Valens keeps track of these
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
 * Note: as Valens is an UIComponent it can be passed the normal
 * UIComponent props like props.parentUIContext: however the resulting
 * local uiContext.focus will not
 * affect the live props and is only used for the children (if any).
 *
 * @export
 * @class Valens
 * @extends {UIComponent}
 */
export default class Valens extends UIComponent {
  static mainLensSlotName = "valensLens";

  static propTypes = {
    ...UIComponent.propTypes,
    hierarchyKey: PropTypes.string,
    elementType: PropTypes.any.isRequired,
    elementPropsSeq: PropTypes.arrayOf(PropTypes.any).isRequired,
    propsKueriesSeq: PropTypes.arrayOf(PropTypes.any),
  }
  static valensPropsBehaviors = {
    ...UIComponent.valensPropsBehaviors,
    propsKueriesSeq: false,
  }

  getKey () {
    return this.props.hierarchyKey || this.context.parentUIContext.reactComponent.getKey();
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
    _initializeElementPropsToLive(this, props, live, kueryStates);
    // stateLive.ongoingKueries = _refreshOngoingKueries(
    //    this, immediateKueryValues, Object.keys(props.propsKueriesSeq));
    this.setState({ live });
    return false;
  }

  unbindSubscriptions () {
    super.unbindSubscriptions();
    if (this.state.live) this.state.live.isUnbound = true;
    this.setState({ live: null });
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
    // Use the props slots of the parent component because Valens
    // cannot be explicitly passed any props.
    // These slot props should probably be passed to Valens inside props, though...
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
    if (stateLive.pendingProps) {
      const pendingPropNames = _refreshPendingProps(stateLive);
      if (pendingPropNames) {
        return this.renderSlotAsLens("pendingPropsLens", pendingPropNames);
      }
    }

    let finalType = this.props.elementType;
    let children = this.props.children;

    if (stateLive.frameOverrides) {
      // Denote that frame overrides object has been rendered and that
      // any new frame updates should create a new override object
      stateLive.frameOverrides = null;
    }
    if (stateLive.valoscopeProps) {
      finalType = Valoscope;
      children = stateLive.valoscopeChildren;
      if (!children) {
        stateLive.elementProps.children = this.props.children;
        children = stateLive.valoscopeChildren =
            [React.createElement(this.props.elementType, stateLive.elementProps)];
      }
    }

    /* Only enable this section for debugging React key warnings; it will break react elsewhere
    if (elementType === Valoscope) {
      elementType = class DebugValoscope extends Valoscope {};
      Object.defineProperty(elementType, "name", {
        value: `Valoscope_${stateLive.elementProps.className || ""}${this.getKey()}`,
      });
    }
    /* */
    const finalProps = stateLive.valoscopeProps || stateLive.elementProps;
    if (!stateLive.createKey) {
      _valensRecorderProps.key(stateLive);
    }
    finalProps.children = children;

    if (stateLive.array) {
      if (!Array.isArray(stateLive.array)) {
        return this.renderSlotAsLens("arrayNotIterableLens", stateLive.array);
      }
      return this.renderFocusAsSequence(stateLive.array, finalType, finalProps, undefined,
          stateLive.createKey, stateLive.renderRejection, true);
    }
    const rejection = stateLive.renderRejection && stateLive.renderRejection(focus);
    if (rejection !== undefined) return rejection;
    finalProps.key = stateLive.createKey(focus, null, finalProps);
    return postRenderElement(this, React.createElement(finalType, finalProps), focus);
  }
}

function _createStateLive (component, props) {
  const isValoscope = props.elementType === Valoscope;
  return {
    component,
    isValoscope,
    frame: component.getUIContextValue("frame") || {},
    kueryValues: {},
    recorders: isValoscope
            ? _valoscopeRecorders
        : props.elementType.isUIComponent
            ? _componentRecorders
            : _elementRecorders,
    pendingProps: null,
    elementProps: {},
  };
}

const _liveKueryPropChain = [
  function _bindRepeathenableLiveKuery (scope) {
    if (!scope) throw new Error("Scope missing");
    return this.component.bindLiveKuery(this.kueryName, this.frame, this.kuery,
            { asRepeathenable: true, scope });
  },
  function _extractLiveUpdateValue (liveUpdate: LiveUpdate) {
    return [liveUpdate.value()];
  },
  _recordUpdatedKueryValue,
];

const _staticKueryPropChain = [
  function _runImmediateKuery (scope) {
    return [(this.frame instanceof Vrapper)
        ? this.frame.step(this.kuery, { scope })
        : this.component.context.engine.run(this.frame, this.kuery, { scope })];
  },
  _recordUpdatedKueryValue,
];

function _recordUpdatedKueryValue (newKueryValue) {
  const stateLive = Object.getPrototypeOf(this);
  if (stateLive.isUnbound) return thisChainReturn(false); // return false to detach subscription
  const kueryValues = stateLive.kueryValues;
  const previousKueryValue = kueryValues[this.kueryName];
  kueryValues[this.kueryName] = newKueryValue;
  // no dependentProps means initial binding phase
  if (!this.dependentProps || (newKueryValue === previousKueryValue)) return undefined;
  let update;
  for (const [propName, propFetcher] of this.dependentProps) {
    if (!(stateLive.recorders[propName] || _recordNewGenericPropValue)(
        stateLive, propFetcher(kueryValues), propName, stateLive.component)) {
      update = true;
    }
  }
  if (update) stateLive.component.forceUpdate();
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
      `Exception caught during Valens._liveKueryPropChain('${this.kueryName}')`);
}

function _initializeElementPropsToLive (component, props, stateLive, kueryStates) {
  const kueryValues = stateLive.kueryValues;
  for (const [propName, propValue] of props.elementPropsSeq) {
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
    (stateLive.recorders[propName] || _recordNewGenericPropValue)(
        stateLive, newValue, propName, component);
  }
}

function _recordNewGenericPropValue (stateLive, propValue, propName, component) {
  try {
    let newName = propName, newValue = propValue;
    if (isPromise(propValue)) {
      throw new Error("INTERNAL ERROR: _recordNewGenericPropValue should never see promises");
    }
    if (propName[0] === "$") {
      const index = propName.indexOf(".");
      if (index === -1) {
        throw new Error(`Namespaced attribute is missing the '.'-separator: '${propName}'`);
      }
      const namespace = propName.slice(1, index);
      const name = propName.slice(index + 1);
      if (namespace === "Context") {
        component.state.uiContext[name] = propValue;
        return false;
      }
      if (namespace === "On") {
        newValue = _valensWrapCallback(component, propValue, propName);
        newName = `on${name[0].toUpperCase()}${name.slice(1)}`;
      } else if (namespace === "Frame") {
        if (!stateLive.frameOverrides) {
          const targetProps = stateLive.isValoscope
              ? stateLive.elementProps
              : stateLive.valoscopeProps || _emitValoscope(stateLive);
          stateLive.frameOverrides = targetProps.frameOverrides = { ...targetProps.frameOverrides };
        }
        stateLive.frameOverrides[name] = propValue;
        return false;
      } else {
        throw new Error(`Unrecognized attribute ${propName}`);
      }
      /*
      if (namespace === "Lens") {
        if (!stateLive.isValoscope) {
          (stateLive.valoscopeProps || (stateLive.valoscopeProps = {}))[name] = propValue;
          return;
        }
        newName = name;
      }
      */
    } else if (propName.startsWith("on")
        && (!stateLive.isValoscope || (propName[2] === propName[2].toUpperCase()))) {
      /*
      console.debug(`DEPRECATED: React-style camelcase event handler '${propName}', prefer 'On:${
          propName[2].toLowerCase()}${propName.slice(3)} (in ${
          component.props.hierarchyKey})`);
      */
      newValue = _valensWrapCallback(component, propValue, propName);
    }
    if (stateLive.elementProps[newName] === newValue) return true;
    stateLive.elementProps[newName] = newValue;
    if (stateLive.valoscopeProps) stateLive.valoscopeChildren = null;
    return false;
  } catch (error) {
    throw wrapError(error, new Error(`_recordNewGenericPropValue('${propName}')`),
        "\n\tvalue:", ...dumpObject(propValue),
        "\n\tstateLive:", ...dumpObject(stateLive),
        "\n\tcomponent:", ...dumpObject(component));
  }
}

// These props have namespace Lens and are available to all elements
// and components, but they are resolved by the valens and do not
// by default appear on the contained element.
const _valensRecorderProps = {
  key (stateLive, newValue) {
    let keyPrefix = stateLive.component.getParentUIContextValue(Lens.frameKeyPrefix) || "";
    if (keyPrefix) keyPrefix = `${keyPrefix}_`;
    if (newValue == null) {
      stateLive.createKey = createDynamicKey;
      stateLive.component.setUIContextValue(Lens.frameKeyPrefix,
          `${keyPrefix}${stateLive.component.props.hierarchyKey}`);
      return;
    }
    if (typeof newValue === "function") {
      stateLive.createKey = function _createExplicitKey (focus_, arrayIndex, entryProps) {
        return (entryProps.frameKey = newValue(focus_, arrayIndex, keyPrefix));
      };
    } else {
      const staticFrameKey = `${keyPrefix}${newValue}`;
      stateLive.createKey = function _createSharedKey (focus_, arrayIndex, entryProps) {
        if (arrayIndex == null) {
          return (entryProps.frameKey = staticFrameKey);
        }
        entryProps.sharedArrayFrameKey = staticFrameKey;
        if (arrayIndex) delete entryProps.frameOverrides;
        return String(arrayIndex);
      };
    }
  },
  children: "children",
  ref (stateLive, newValue) {
    stateLive.elementProps.ref = _valensWrapCallback(stateLive.component, newValue, "$Lens.ref");
    if (stateLive.valoscopeProps) stateLive.valoscopeChildren = null;
  },
  styleSheet (stateLive, newValue) {
    if (newValue) {
      stateLive.component.setUIContextValue(VSSStyleSheetSymbol, newValue);
    } else {
      stateLive.component.clearUIContextValue(VSSStyleSheetSymbol);
    }
  },
  if: function if_ (stateLive, newValue) {
    const oldValue = stateLive.if;
    if (newValue === oldValue && ((oldValue !== undefined) || stateLive.hasOwnProperty("if"))) {
      return true;
    }
    stateLive.if = newValue;
    stateLive.renderRejection =
          !newValue
              ? (focus => stateLive.component.renderLens(stateLive.else, focus))
          : (typeof newValue !== "function")
              ? (stateLive.then === undefined)
                  ? undefined
                  : (focus => stateLive.component.renderLens(stateLive.then, focus))
          : function _checkAndRenderRejection (focus, index) {
            const condition = newValue(focus, index);
            return !condition
                    ? stateLive.component.renderLens(stateLive.else, focus)
                : stateLive.then !== undefined
                    ? stateLive.component.renderLens(stateLive.then, focus)
                : undefined;
          };
    return !newValue === !oldValue;
  },
  else: function else_ (stateLive, newValue) {
    stateLive.else = newValue;
    return stateLive.if;
  },
  then: function then_ (stateLive, newValue) {
    stateLive.then = newValue;
    return !stateLive.if;
  },
  context (stateLive, newValue) {
    Object.assign(stateLive.component.state.uiContext, newValue);
  },
};

// These props have namespace Lens and are allowed on all elements.
// However their presence on non-valoscope elements triggers the
// emission of an intermediate valoscope to which they are assigned.
const _emitValoscopeRecorderProps = {
  focus: "focus",
  array (stateLive, newValue) {
    stateLive.array = !Array.isArray(newValue)
            && (typeof newValue[Symbol.iterator] === "function")
        ? [...newValue]
        : newValue;
  },
  frameKey: "frameKey",

  lens: "lens",
  lensProperty: "lensProperty",
  focusLensProperty: "focusLensProperty",
  delegateLensProperty: "delegateLensProperty",
  instanceLensProperty: "instanceLensProperty",
  instanceLensPrototype: "instanceLensPrototype",

  valoscope (stateLive, newValue) {
    Object.assign(
        stateLive.valoscopeProps || _emitValoscope(stateLive),
        newValue || {});
  },
};

// These props have namespace Lens and are allowed only on valoscope
// elements.
const _valoscopeRecorderProps = {
  frameOverrides: "frameOverrides",
  delegate (stateLive, newValue) {
    if (stateLive.component.props.elementPropsSeq.length !== 1) {
      throw new Error("'delegate' attribute must always be the only attribute");
    }
    stateLive.delegate = newValue;
  },
  valoscope (stateLive, newValue) { // overrides the _emitValoscopeRecorderProps.valoscope version
    Object.assign(stateLive.elementProps, newValue || {});
  },
};

// These props have namespace Element and are only available for
// non-component elements.
const _elementRecorderProps = {
  class: _className,
  className: _className,
  style: "style",
  styleSheet: "styleSheet",
};

function _className (stateLive, newValue) {
  stateLive.elementProps.className = _refreshClassName(stateLive.component, newValue);
  if (stateLive.valoscopeProps) stateLive.valoscopeChildren = null;
}

function _createRecorder (propName, propRecorderValue, namespace) {
  return [
    (!namespace || (propName[0] === "$"))
        ? propName
        : `$${namespace}.${propName}`,
    (typeof propRecorderValue !== "string")
        ? propRecorderValue
        : function _recordProp (stateLive, propValue) {
          stateLive.elementProps[propRecorderValue] = propValue;
          if (stateLive.valoscopeProps) stateLive.valoscopeChildren = null;
        },
  ];
}

function _createEmitRecorder (propName, propRecorderValue, namespace) {
  return [
    (!namespace || (propName[0] === "$"))
        ? propName
        : `$${namespace}.${propName}`,
    (typeof propRecorderValue !== "string")
        ? function _recordValoscopeProp (stateLive, propValue) {
          if (!stateLive.valoscopeProps) _emitValoscope(stateLive);
          propRecorderValue(stateLive, propValue);
        }
        : function _recordValoscopeProp (stateLive, propValue) {
          (stateLive.valoscopeProps || _emitValoscope(stateLive))[propRecorderValue] = propValue;
        },
  ];
}

function _emitValoscope (stateLive) {
  return stateLive.valoscopeProps = {};
}

const _valoscopeRecorders = Object.fromEntries([
  ...Object.entries(_valensRecorderProps).map(([k, v]) => _createRecorder(k, v, "Lens")),
  ...Object.entries(_valensRecorderProps).map(([k, v]) => _createRecorder(k, v)),

  ...Object.entries(_emitValoscopeRecorderProps).map(([k, v]) => _createRecorder(k, v, "Lens")),
  ...Object.entries(_emitValoscopeRecorderProps).map(([k, v]) => _createRecorder(k, v)),

  ...Object.entries(_valoscopeRecorderProps).map(([k, v]) => _createRecorder(k, v, "Lens")),
  ...Object.entries(_valoscopeRecorderProps).map(([k, v]) => _createRecorder(k, v)),
]);

const _componentRecorders = Object.fromEntries([
  ...Object.entries(_valensRecorderProps).map(([k, v]) => _createRecorder(k, v, "Lens")),
  ...Object.entries(_valensRecorderProps).map(([k, v]) => _createRecorder(k, v)),

  ...Object.entries(_emitValoscopeRecorderProps).map(([k, v]) => _createEmitRecorder(k, v, "Lens")),
  ...Object.entries(_emitValoscopeRecorderProps).map(([k, v]) => _createEmitRecorder(k, v)),
]);

const _elementRecorders = Object.fromEntries([
  ...Object.entries(_valensRecorderProps).map(([k, v]) => _createRecorder(k, v, "Lens")),

  ...Object.entries(_emitValoscopeRecorderProps).map(([k, v]) => _createEmitRecorder(k, v, "Lens")),

  ...Object.entries(_elementRecorderProps).map(([k, v]) => _createRecorder(k, v, "Element")),
  ...Object.entries(_elementRecorderProps).map(([k, v]) => _createRecorder(k, v)),
]);

/*
function _refreshOngoingKueries (component, kueryValues, ongoingKueries) {
  if (!ongoingKueries || !ongoingKueries.length) return ongoingKueries;
  const ret = ongoingKueries.filter(kueryName => !kueryValues.hasOwnProperty(kueryName));
  return !ret.length ? null
      : (ret.length < ongoingKueries) ? ret
      : ongoingKueries; // no change
}
*/

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

function _refreshClassName (component, value, focus = component.tryFocus()) {
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

function _valensWrapCallback (component: Valens, callback_: Function, name: string) {
  if (!callback_) return callback_;
  const callback = (callback_ === "function") ? callback_
      : getImplicitCallable(callback_, name, { synchronous: undefined });
  const isVCall = callback._isVCall;
  const callName = !isVCall ? `valensExtCall_${name}` : `valensVCall_${name}`;

  const ret = function _valensCall (...args: any[]) {
    try {
      let eThis = this;
      if (isVCall && ((this == null) || !this.__callerValker__)) {
        eThis = !this ? {} : Object.create(this);
        eThis.__callerValker__ = component.context.engine.discourse;
        eThis.__callerScope__ = component.getUIContext();
      }
      return callback.apply(eThis, args);
    } catch (error) {
      const absentChronicleSourcings = tryConnectToAbsentChroniclesAndThen(error,
          () => ret.apply(this, args));
      if (absentChronicleSourcings) return absentChronicleSourcings;
      const finalError = wrapError(error,
          new Error(`attribute ${name} call in ${component.props.hierarchyKey}`),
          "\n\targs:", args,
          "\n\tcontext:", ...dumpObject(component.state.uiContext),
          "\n\tcomponent:", ...dumpObject(component),
      );
      component.enableError(finalError, `Exception caught during '${callName}'`);
    }
    return undefined;
  };
  Object.defineProperty(ret, "name", { value: callName });
  if (isVCall) {
    ret._isVCall = true;
    ret[toVAKONTag] = callback[toVAKONTag];
    ret[SourceInfoTag] = callback[SourceInfoTag];
    }
  return ret;
}
