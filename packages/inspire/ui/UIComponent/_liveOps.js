// @flow

import { tryConnectToAbsentChroniclesAndThen } from "~/raem/tools/denormalized/partitions";
import { SourceInfoTag } from "~/raem/VALK/StackTrace";

import Vrapper, { LiveUpdate, getImplicitCallable } from "~/engine/Vrapper";
import VALEK, { toVAKONTag, IsLiveTag } from "~/engine/VALEK";

import getImplicitMediaInterpretation from "~/engine/Vrapper/getImplicitMediaInterpretation";

import Lens from "~/inspire/valosheath/valos/Lens";

import {
  dumpObject, patchWith, isPromise, isSymbol, thisChainEagerly, thisChainReturn, wrapError
} from "~/tools";

import { VSSStyleSheetSymbol } from "./_styleOps";

export function _bindLiveSubscriptions (component, focus, props) {
  const live = _createStateLive(component, props);
  const kueryStates = {};
  const maybeDelayedContext = component.maybeDelayed(
      Lens.pendingAttributesLens, component.getUIContext());
  for (const [kueryName, kuery] of (props.propsKueriesSeq || [])) {
    const propState = kueryStates[kueryName] = Object.create(live);
    propState.kueryName = kueryName;
    propState.kuery = kuery;
    thisChainEagerly(propState,
        maybeDelayedContext,
        (kuery[IsLiveTag] === false)
            ? _staticKueryPropChain
            : _liveKueryPropChain,
        _errorOnBindLiveSubscriptions);
  }
  _initializeElementPropsToLive(component, props, live, kueryStates);
  component.rerender("liveSubscriptions", { live });
}

function _errorOnBindLiveSubscriptions (error) {
  this.component.enableError(wrapError(error,
          new Error(`_liveKueryPropChain('${this.kueryName}')`),
          "\n\tuiContext:", ...dumpObject(this.component.state.uiContext),
          "\n\tfocus:", ...dumpObject(this.component.tryFocus()),
          "\n\tkuery:", ...dumpObject(this.kuery),
          "\n\tstate:", ...dumpObject(this.component.state),
          "\n\tprops:", ...dumpObject(this.component.props)),
      `Exception caught during Valens._liveKueryPropChain('${this.kueryName}')`);
}

function _createStateLive (component, props) {
  const ret = {
    component,
    frame: component.getUIContextValue("frame") || {},
    kueryValues: {},
    pendingProps: null,
  };
  if (props.elementType.isValoscope) {
    _obtainValoscopeProps(ret);
    ret.recorders = _valoscopeRecorders;
  } else if (props.elementType.isUIComponent) {
    ret.elementProps = {};
    ret.recorders = _componentRecorders;
    if (props.delayed) ret.elementProps.delayed = props.delayed;
  } else {
    ret.elementProps = {};
    ret.recorders = _elementRecorders;
  }
  return ret;
}

const _liveKueryPropChain = [
  function _bindRepeathenableLiveKuery (scope) {
    if (!scope) throw new Error("Scope missing");
    return this.component.bindLiveKuery(
        this.kueryName, this.frame, this.kuery, { asRepeathenable: true, scope });
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

function _initializeElementPropsToLive (component, props, stateLive, kueryStates) {
  const kueryValues = stateLive.kueryValues;
  for (const [propName, propValue] of props.elementPropsSeq) {
    let newValue = propValue;
    if ((typeof newValue === "function") && newValue.kueryName) {
      let isPending;
      if (!kueryValues.hasOwnProperty(newValue.kueryName)) isPending = true;
      (kueryStates[newValue.kueryName].dependentProps
              || (kueryStates[newValue.kueryName].dependentProps = []))
          .push([propName, newValue]);
      if (isPending) {
        (stateLive.pendingProps || (stateLive.pendingProps = []))
            .push([propName, newValue.kueryName]);
        continue;
      }
      newValue = newValue(kueryValues);
    }
    (stateLive.recorders[propName] || _recordNewGenericPropValue)(
        stateLive, newValue, propName, component);
  }
}

function _recordUpdatedKueryValue (newKueryValue) {
  const stateLive = Object.getPrototypeOf(this);
  if (stateLive.isUnbound) return thisChainReturn(false); // return false to detach subscription
  const kueryValues = stateLive.kueryValues;
  const previousKueryValue = kueryValues[this.kueryName];
  kueryValues[this.kueryName] = newKueryValue;
  // no dependentProps means initial binding phase
  if (!this.dependentProps || (newKueryValue === previousKueryValue)) return undefined;
  let wasUpdated;
  const component = stateLive.component;
  for (const [propName, propFetcher] of this.dependentProps) {
    if (!(stateLive.recorders[propName] || _recordNewGenericPropValue)(
        stateLive, propFetcher(kueryValues), propName, component)) {
      wasUpdated = true;
    }
  }
  if (wasUpdated) component.rerender(this.kueryName);
  return undefined;
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
          const targetProps = _obtainValoscopeProps(stateLive);
          stateLive.frameOverrides = targetProps.frameOverrides = { ...targetProps.frameOverrides };
        }
        stateLive.frameOverrides[name] = propValue;
        return false;
      } else {
        throw new Error(`Unrecognized attribute ${propName}`);
      }
    } else if (propName.startsWith("on")
        && (stateLive.elementProps || (propName[2] === propName[2].toUpperCase()))) {
      /*
      console.debug(`DEPRECATED: React-style camelcase event handler '${propName}', prefer 'On:${
          propName[2].toLowerCase()}${propName.slice(3)} (in ${
          component.getKey()})`);
      */
      newValue = _valensWrapCallback(component, propValue, propName);
    }
    const targetProps = stateLive.elementProps || stateLive.valoscopeProps;
    if (targetProps[newName] === newValue) return true;
    targetProps[newName] = newValue;
    if (stateLive.valoscopeProps) stateLive.valoscopeChildren = null;
    return false;
  } catch (error) {
    throw wrapError(error, new Error(`_recordNewGenericPropValue('${propName}')`),
        "\n\tvalue:", ...dumpObject(propValue),
        "\n\tstateLive:", ...dumpObject(stateLive),
        "\n\tcomponent:", ...dumpObject(component));
  }
}

function _obtainValoscopeProps (stateLive) {
  let ret = stateLive.valoscopeProps;
  if (!ret) {
    ret = stateLive.valoscopeProps = {};
    if (stateLive.component.props.delayed) {
      ret.delayed = stateLive.component.props.delayed;
    }
  }
  return ret;
}

// These props have namespace Lens and are available to all elements
// and components, but they are resolved by the valens and do not
// by default appear on the contained element.
export const _valensRecorderProps = {
  frame: recordFrameKey,
  // children: "children",
  ref (stateLive, newValue) {
    (stateLive.elementProps || stateLive.valoscopeProps).ref =
        _valensWrapCallback(stateLive.component, newValue, "$Lens.ref");
    if (stateLive.valoscopeProps) stateLive.valoscopeChildren = null;
  },
  styleSheet (stateLive, newValue) {
    if (newValue) {
      stateLive.component.setUIContextValue(VSSStyleSheetSymbol, newValue);
    } else {
      stateLive.component.clearUIContextValue(VSSStyleSheetSymbol);
    }
  },
  offset (stateLive, newValue) {
    if (stateLive.offset === newValue) return true;
    stateLive.offset = newValue;
    return false;
  },
  if: function if_ (stateLive, newValue) {
    const oldValue = stateLive.if;
    if (newValue === oldValue && ((oldValue !== undefined) || stateLive.hasOwnProperty("if"))) {
      return true;
    }
    stateLive.if = newValue;
    stateLive.renderRejection = null;
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
  limit (stateLive, newValue) {
    if (stateLive.limit === newValue) return true;
    stateLive.limit = newValue;
    return false;
  },
  sort (stateLive, newValue) {
    if (stateLive.sort === newValue) return true;
    stateLive.sort = newValue;
    return false;
  },
  reverse (stateLive, newValue) {
    if (stateLive.reverse === newValue) return true;
    stateLive.reverse = newValue;
    return false;
  },
  context (stateLive, newValue) {
    Object.assign(stateLive.component.state.uiContext, newValue);
  },
};

// These props have namespace Lens and are allowed on all elements.
// However their presence on non-valoscope elements triggers the
// emission of an intermediate valoscope to which they are assigned.
export const _emitValoscopeRecorderProps = {
  focus: "focus",
  array (stateLive, newValue) {
    stateLive.array = !Array.isArray(newValue)
            && (typeof newValue[Symbol.iterator] === "function")
        ? [...newValue]
        : newValue;
    // enable stateLive as renderFocusAsSequence options object
    stateLive.onlyPostRender = true;
    stateLive.setEndOffset = true;
  },
  frameKey: "frameKey",

  lens: "lens",
  lensProperty: "lensProperty",
  focusLensProperty: "focusLensProperty",
  delegateLensProperty: "delegateLensProperty",
  instanceLensProperty: "instanceLensProperty",
  instanceLensPrototype: "instanceLensPrototype",

  valoscope (stateLive, newValue) {
    Object.assign(_obtainValoscopeProps(stateLive), newValue || {});
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
};

// These props have namespace HTML and are only available for
// non-component elements.
const _elementRecorderProps = {
  class: _className,
  className: _className,
  style: "style",
  styleSheet: "styleSheet",
};

export function recordFrameKey (stateLive, newValue) {
  if (!newValue) return;
  const component = stateLive.component;
  let keyOp;
  if (newValue !== LensElementKey) _obtainValoscopeProps(stateLive);
  if (typeof newValue === "function") {
    const stepPrefix = component.getParentUIContextValue(Lens.frameStepPrefix) || "";
    stateLive.keyFromFocus = function _createCustomKey (focus, arrayIndex, entryProps) {
      return (entryProps.frameKey = newValue(focus, arrayIndex, stepPrefix));
    };
  } else if (typeof newValue === "string") {
    const stepPrefix = component.getParentUIContextValue(Lens.frameStepPrefix) || "";
    stateLive.keyFromFocus = _keyFromFocusOps
        .createStaticKey.bind(null, !stepPrefix ? newValue : `${stepPrefix}:${newValue}`);
  } else if ((keyOp = _keyFromFocusOps[newValue])) { // eslint-disable-line
    stateLive.keyFromFocus = keyOp.bind(component, component.getKey());
  } else if (isSymbol(newValue)) {
    const keyFromFocus = component.getParentUIContextValue(newValue);
    if (typeof keyFromFocus !== "function") {
      throw new Error(`Invalid $Lens.frame namespaced value '${String(newValue)
          }': does not resolve to valid frame key callback, got '${typeof keyFromFocus}'`);
    }
    stateLive.keyFromFocus = keyFromFocus;
  } else {
    throw new Error(`Invalid $Lens.frame: expected callback, symbol, string or nully, got '${
      typeof newValue}'`);
  }
}

export const LensElementKey = Symbol("LensElementKey");

const _keyFromFocusOps = {
  createStaticKey (keyPrefix, focus, arrayIndex, entryProps) {
    entryProps.staticFrameKey = keyPrefix;
    if (arrayIndex == null) return keyPrefix;
    if (arrayIndex) delete entryProps.frameOverrides; // kludge: apply frame overrides only once
    return String(arrayIndex);
  },
  [LensElementKey] (keyPrefix, focus, arrayIndex) {
    return `${arrayIndex != null ? `$d.${arrayIndex}` : ""}${
        focus instanceof Vrapper ? `$focus.${focus.getBriefUnstableId()}@@` : ""}`;
  },
  [Lens.frame] (keyPrefix, focus, arrayIndex, entryProps) {
    const keySuffix = `${arrayIndex != null ? `$d.${arrayIndex}` : ""}${
        focus instanceof Vrapper ? `$focus.${focus.getBriefUnstableId()}@@` : ""}`;
    entryProps.frameKey = `${keyPrefix}${keySuffix}`;
    return keySuffix;
  },
  [Lens.focus] (keyPrefix, focus, arrayIndex, entryProps) {
    const keySuffix = (focus instanceof Vrapper) ? `$focus.${focus.getBriefUnstableId()}@@`
        : (arrayIndex == null) && "$.non_resource";
    if (!keySuffix) {
      throw new Error(`Cannot create $Lens.frame={$Lens.focus
          } from non-resoure entry at $Lens.array[${arrayIndex}]`);
    }
    entryProps.frameKey = `${keyPrefix}${keySuffix}`;
    return keySuffix;
  },
  [Lens.arrayIndex] (keyPrefix, focus, arrayIndex, entryProps) {
    entryProps.frameKey = `${keyPrefix}$d.${arrayIndex}`;
    return String(arrayIndex);
  },
};

function _className (stateLive, newValue) {
  stateLive.elementProps.className = _refreshClassName(stateLive.component, newValue);
  if (stateLive.valoscopeProps) stateLive.valoscopeChildren = null;
}

function _refreshClassName (component, value, focus = component.tryFocus()) {
  if ((value == null) || !(value instanceof Vrapper)) return value;
  const bindingSlot = `props_className_content`;
  if (value.hasInterface("Media") && !component.getBoundSubscription(bindingSlot)) {
    component.bindLiveKuery(bindingSlot, value, VALEK.toMediaContentField(), {
      onUpdate: function updateClassContent () {
        if (component.tryFocus() !== focus) return false;
        component.rerender("className");
        return undefined;
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

function _createRecorder (propName, propRecorderValue, namespace) {
  return [
    (!namespace || (propName[0] === "$"))
        ? propName
        : `$${namespace}.${propName}`,
    (typeof propRecorderValue !== "string")
        ? propRecorderValue
        : function _recordProp (stateLive, propValue) {
          (stateLive.elementProps || stateLive.valoscopeProps)[propRecorderValue] = propValue;
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
          _obtainValoscopeProps(stateLive);
          propRecorderValue(stateLive, propValue);
        }
        : function _recordValoscopeProp (stateLive, propValue) {
          _obtainValoscopeProps(stateLive)[propRecorderValue] = propValue;
        },
  ];
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

  ...Object.entries(_elementRecorderProps).map(([k, v]) => _createRecorder(k, v, "HTML")),
  ...Object.entries(_elementRecorderProps).map(([k, v]) => _createRecorder(k, v)),
]);

function _valensWrapCallback (component: Object, callback_: Function, attributeName: string) {
  if (!callback_) return callback_;
  const callback = (callback_ === "function") ? callback_
      : getImplicitCallable(callback_, attributeName, { synchronous: undefined });
  const isVCall = callback._isVCall;
  const callName = !isVCall ? `valensExtCall_${attributeName}` : `valensVCall_${attributeName}`;

  const ret = function _valensCall (...args: any[]) {
    let fabricator, releaseOpts;
    try {
      let eThis = this;
      if (isVCall) {
        eThis = !this ? {} : Object.create(this);
        fabricator = eThis.__callerValker__ =
            (eThis.__callerValker__ || component.context.engine.discourse)
                .acquireFabricator(attributeName);
        eThis.__callerScope__ = component.getUIContext();
      }
      return callback.apply(eThis, args);
    } catch (error) {
      releaseOpts = { rollback: error };
      const absentChronicleSourcings = tryConnectToAbsentChroniclesAndThen(error,
          () => ret.apply(this, args));
      if (absentChronicleSourcings) return absentChronicleSourcings;
      const finalError = wrapError(error,
          new Error(`attribute ${attributeName} call in ${component.getKey()}`),
          "\n\targs:", args,
          "\n\tcontext:", ...dumpObject(component.state.uiContext),
          "\n\tcomponent:", ...dumpObject(component),
      );
      component.enableError(finalError, `Exception caught during '${callName}'`);
    } finally {
      if (fabricator) fabricator.releaseFabricator(releaseOpts);
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
