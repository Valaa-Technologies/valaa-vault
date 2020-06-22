// @flow

import React from "react";
import { OrderedMap } from "immutable";

import { Kuery } from "~/raem/VALK";

import Vrapper from "~/engine/Vrapper";
import VALEK from "~/engine/VALEK";
import debugId from "~/engine/debugId";

import { arrayFromAny, isPromise, isSymbol, thenChainEagerly, wrapError } from "~/tools";

import UIComponent, { isUIComponentElement } from "./UIComponent";
import { uiComponentProps, createComponentKey } from "./_propsOps";

/* eslint-disable react/prop-types */

// In general the _renderOps operations here delegate rendering to each
// other via the component .render* and not directly to get proper
// exception context wrappers in place.

export function _renderFirstAbleDelegate (
    component: UIComponent, delegates: any[], focus: any, lensName: string) {
  for (const delegate of arrayFromAny(delegates)) {
    const ret = component.renderLens(delegate, focus, lensName, true);
    if (ret !== null) return ret;
  }
  return null;
}

export function _renderFocusAsSequence (component: UIComponent,
    foci: any[], EntryElement: Object, entryProps: Object,
    keyFromFocus?: (focus: any, index: number) => string,
): [] {
  // Wraps the focus entries EntryElement, which is UIComponent by default.
  // Rendering a sequence focus can't be just a foci.map(_renderFocus) because individual entries
  // might have pending kueries or content downloads.
  const parentUIContext = component.getUIContext();
  const parentKey = component.getKey() || "-";
  return arrayFromAny(foci).map((focus, arrayIndex) => {
    const key = keyFromFocus ? keyFromFocus(focus, arrayIndex)
        : createComponentKey(parentKey, focus, arrayIndex);
    const props = {
      ...entryProps,
      focus,
      parentUIContext,
      context: { ...(entryProps.context || {}), forIndex: arrayIndex, arrayIndex },
      key, elementKey: key,
    };
    return _wrapElementInLiveProps(
        component,
        React.createElement(EntryElement, props, ...arrayFromAny(component.props.children)),
        focus, props.key);
  });
}

export function _renderFocus (component: UIComponent,
    focus: any
): null | string | React.Element<any> | [] | Promise<any> {
  if (!component.preRenderFocus) {
    return component.renderLensSequence(component.props.children, focus, "focus");
  }
  const preRendered = component.preRenderFocus(focus);
  const ret = component.tryRenderLens(preRendered, focus, "focus");
  if (typeof ret !== "undefined") return ret;
  if (typeof preRendered === "object") return preRendered;
  const key = component.getUIContextValue("key");
  if (key) return <span key={key}>{preRendered}</span>;
  return <span>{preRendered}</span>;
}

export function _tryRenderLensArray (component: UIComponent,
    lensArray: any[], focus: any, lensName?: string
): void | [] | Promise<any[]> {
  let ret; // remains undefined if no entry tryRenderLens makes any changes
  let hasPromise;
  for (let i = 0; i !== lensArray.length; ++i) {
    const processedEntry = component.tryRenderLens(
        lensArray[i], focus, `#${String(i)}-${lensName || ""}`);
    if (typeof processedEntry !== "undefined") {
      if (isPromise(processedEntry)) hasPromise = true;
      if (!ret) ret = lensArray.slice(0, i);
      ret.push(processedEntry);
    } else if (ret) ret.push(lensArray[i]);
  }
  if (hasPromise) ret = Promise.all(ret);
  return ret;
}

let _Valoscope;

export function _tryRenderLens (component: UIComponent, lens: any, focus: any,
    lensName: string, onlyIfAble?: boolean, onlyOnce?: boolean,
): void | null | string | React.Element<any> | [] | Promise<any> {
  if (!_Valoscope) _Valoscope = require("../Valoscope").default;
  let ret;
  let subLensName;
  switch (typeof lens) {
    default:
      return undefined;
    case "undefined":
      return null;
    case "function": {
      const contextThis = component.getUIContextValue("component");
      subLensName = `${lens.name}-${lensName}`;
      ret = lens.call(contextThis, focus, component, lensName);
      break;
    }
    case "object":
      if ((lens === null) || isPromise(lens)) {
        return undefined;
      }
      if (React.isValidElement(lens)) {
        return _tryWrapElementInLiveProps(component, lens, focus, lensName);
      }
      if (lens instanceof Kuery) {
        // Delegates the kuery resolution to LiveProps.
        subLensName = `§-${lensName}`;
        const delayed = thenChainEagerly(
            component.bindLiveKuery(subLensName, component.getUIContextValue("frame"), lens,
                { asRepeathenable: true, scope: component.getUIContext() }),
            update => {
              let newLensValue = update.value();
              if (newLensValue === undefined) newLensValue = null;
              if (ret === undefined) {
                ret = newLensValue;
              } else if (ret !== newLensValue) {
                component.forceUpdate();
              }
            });
        if (ret === undefined) ret = delayed || null;
        // ret = React.createElement(UIComponent,
        //    component.childProps(subLensName, {}, { delegate: [lens] }));
      } else if (lens instanceof Vrapper) {
        const activation = lens.activate();
        if (activation !== lens) {
          activation.operationInfo = Object.assign(activation.operationInfo || {}, {
            slotName: "pendingActivationLens", focus: lens,
            onError: { slotName: "failedActivationLens", resource: lens },
          });
          // Ensure that re-render is triggered by top level _render
          return activation.then(() => undefined);
        }
        if (lens.hasInterface("Media")) {
          ret = _tryRenderMediaLens(component, lens, focus, lensName);
          subLensName = `~-${lensName}`;
        } else {
          const valos = component.getValos();
          subLensName = `.-${lensName}`;
          ret = component.readSlotValue("delegatePropertyLens",
              valos.Lens.delegatePropertyLens, lens, true)(lens, component, lensName);
          if ((ret == null) || ((ret.delegate || [])[0] === valos.Lens.notLensResourceLens)) {
            return component.renderSlotAsLens("notLensResourceLens", lens, undefined, subLensName);
          }
        }
      } else if (Array.isArray(lens)) {
        return _tryRenderLensArray(component, lens, focus, lensName);
      } else if (Object.getPrototypeOf(lens) === Object.prototype) {
        if (lens.delegate && (Object.keys(lens).length === 1)) {
          return _renderFirstAbleDelegate(component, lens.delegate, focus, lensName);
        }
        subLensName = `-no-${lensName}`;
        ret = React.createElement(_Valoscope, component.childProps(subLensName, {}, { ...lens }));
      } else if (isSymbol(lens)) {
        return component.renderSlotAsLens(lens, focus, undefined, lensName, onlyIfAble, onlyOnce);
      } else {
        throw new Error(`Invalid lens value when trying to render ${lensName
            }, got value of type '${lens.constructor.name}'`);
      }
      break;
    case "symbol":
      return component.renderSlotAsLens(lens, focus, undefined, lensName, onlyIfAble, onlyOnce);
  }
  return thenChainEagerly(ret, resolvedRet => {
    if (resolvedRet === undefined) return undefined;
    if (React.isValidElement(resolvedRet)) {
      return _wrapElementInLiveProps(component, resolvedRet, focus, subLensName);
    }
    if (onlyOnce) return resolvedRet;
    return component.renderLens(resolvedRet, focus, subLensName);
  });
}

function _tryRenderMediaLens (component: UIComponent, media: any, focus: any) {
  const bindingSlot = `UIComponent_media_${media.getRawId()}`;
  if (!component.getBoundSubscription(bindingSlot)) {
    component.bindLiveKuery(bindingSlot, media, VALEK.toMediaContentField(), {
      onUpdate: function onMediaContentUpdate () {
        // If focus has changed detaches the live kuery. This is likely
        // uselessly defensive programming as the whole UIComponent state
        // should refresh anyway whenever the focus changes. Nevertheless
        // return before triggering forceupdate as we're obsolete.
        if (component.tryFocus() !== focus) return false;
        component.forceUpdate();
        return undefined;
      },
      updateImmediately: false,
    });
  }
  const options = { fallbackContentType: "text/vsx" };
  const ret = thenChainEagerly(null, [
    media.interpretContent.bind(media, options),
    function postProcessInterpretedMediaContent (contentInterpretation) {
      let error;
      const info = options.mediaInfo || media.resolveMediaInfo();
      if (typeof contentInterpretation !== "object") {
        if (contentInterpretation !== undefined) return contentInterpretation;
        if (!info.contentHash) throw new Error(`Media '${info.name}' $V.content is missing`);
        error = new Error(
            `Media '${info.name}' interpretation as '${info.contentType}' resolves into undefined`);
      } else if (contentInterpretation.__esModule) {
        if (contentInterpretation.default !== undefined) return contentInterpretation.default;
        error = new Error(`Can't find default export from module Media '${info.name}'`);
      } else if (Array.isArray(contentInterpretation)
          || (Object.getPrototypeOf(contentInterpretation) === Object.prototype)
          || React.isValidElement(contentInterpretation)) {
        return contentInterpretation;
      } else if (contentInterpretation instanceof Error) {
        error = contentInterpretation;
      } else {
        error = new Error(`Media '${info.name}' interpretation as '${
            info.contentType}' resolves into a complex type ${
            (contentInterpretation.constructor || {}).name || "<unnamed>"}`);
      }
      error.slotName = "unrenderableMediaInterpretationLens";
      throw error;
    }
  ], function errorOnRenderMediaLens (error) {
    if (!error.slotName) error.slotName = "mediaInterpretationErrorLens";
    error.media = media;
    error.mediaInfo = options.mediaInfo;
    throw error;
  });
  if (isPromise(ret)) {
    ret.operationInfo = Object.assign(ret.operationInfo || {}, {
      slotName: "pendingMediaInterpretationLens", focus: media,
    });
  }
  return ret;
}

export function _wrapElementInLiveProps (component: UIComponent, element: Object, focus: any,
    name?: string) {
  const ret = _tryWrapElementInLiveProps(component, element, focus, name);
  return (typeof ret !== "undefined") ? ret
      : element;
}

let _LiveProps;

/**
 * If no name is provided then it means the component doesn't necessarily need one.
 *
 * @export
 * @param {UIComponent} component
 * @param {Object} element
 * @param {string} [name]
 * @returns
 */
function _tryWrapElementInLiveProps (component: UIComponent, element: Object, focus: any,
    lensName?: string) {
  const LiveProps = _LiveProps || (_LiveProps = require("./LiveProps").default);

  if ((element.type === LiveProps)
      || LiveProps.isPrototypeOf(element.type)) return undefined;
  const { type: elementType, props, ref, key } = element;
  const liveProps = { currentIndex: 0 };
  const livePropLookup = new Map(); // deduplicate identical kueries
  let elementProps;
  function _obtainLiveElementProps () {
    if (!elementProps) {
      elementProps = { ...props };
      if (ref) elementProps.ref = ref;
    }
    return elementProps;
  }
  try {
    for (const propName of Object.keys(props)) {
      if ((propName === "children")
          || (elementType.noPostProcess && elementType.noPostProcess[propName])) continue;
      const newProp = _postProcessProp(
          props[propName], livePropLookup, liveProps, propName, component);
      if (newProp !== undefined) {
        _obtainLiveElementProps()[propName] = newProp;
      } else if ((propName === "valoscope") || (propName === "valaaScope")
          || (propName === "vScope") || ((propName === "array") && isUIComponentElement(element))) {
        _obtainLiveElementProps();
      }
    }
    if (ref && (ref instanceof Kuery)) {
      // Rewrite ref kuery as onRefKuery so that LiveProps can evaluate it.
      _obtainLiveElementProps().onRefKuery =
          _postProcessProp(ref, livePropLookup, liveProps, "ref", component);
      delete elementProps.ref;
    }

    if (!elementProps) {
      let parentUIContext;
      let children;
      if (isUIComponentElement(element)) {
        // If UIComponent has no live props and already has a uiContext/parentUIContext no
        // processing is required now: The UIComponent does its own post-processing.
        const hasUIContext = props.uiContext || props.parentUIContext;
        if ((key || !lensName) && hasUIContext) return undefined;
        // Otherwise provide the current component context as the parentUIContext for the component.
        if (!hasUIContext) parentUIContext = component.getUIContext();
      } else {
        // non-UIComponent element with no live props: post-process its children directly here.
        children = component.tryRenderLensSequence(props.children, focus, lensName);
        if ((key || !lensName) && (children === undefined)) return undefined;
        if (isPromise(children)) {
          children.operationInfo = Object.assign(children.operationInfo || {}, {
            slotName: "pendingChildrenLens", focus: props.children,
            onError: { slotName: "failedChildrenLens", children: props.children },
          });
          return children;
        }
      }
      const newProps = { ...props };
      if (ref) newProps.ref = ref;
      delete newProps.children;
      if (parentUIContext) newProps.parentUIContext = parentUIContext;
      if (key || lensName) newProps.key = key || lensName;
      return React.createElement(elementType, newProps,
          ...(children || arrayFromAny(props.children)));
    }
    let livePropsProps: any = { elementType, elementProps };
    if (liveProps.currentIndex) {
      delete liveProps.currentIndex;
      livePropsProps.liveProps = liveProps;
    }
    livePropsProps = uiComponentProps({
      name: (typeof key === "string") ? `!${key}`
          : key ? `!.-${lensName}`
          : lensName,
      parentUIContext: component.getUIContext(),
    }, livePropsProps);
    // console.log("_tryWrapElementInLiveProps LiveWrapper for", elementType.name, wrapperProps);
    /* Only enable this section for debugging React key warnings; it will break react elsewhere
    const DebugLiveProps = class DebugLiveProps extends LiveProps {};
    Object.defineProperty(DebugLiveProps, "name", {
      value: `LiveProps_${livePropsProps.key}`,
    });
    // */
    return React.createElement(LiveProps, livePropsProps, ...arrayFromAny(props.children));
  } catch (error) {
    throw wrapError(error, `During ${component.debugId()}\n ._tryWrapElementInLiveProps(`,
            typeof elementType === "function" ? elementType.name : elementType, `), with:`,
        "\n\telement.props:", props,
        "\n\telement.props.children:", props && props.children,
        "\n\tpropsKueries:", liveProps,
        "\n\tlivePropLookup:", livePropLookup,
    );
  }
}

/**
 * Converts all VALK kuery objects in properties into kuery placeholder callback functions and
 * adds the kueries as entries to the new liveProps prop.
 * The kuery placeholder callback takes a livePropValues object which is a map from kueryId to a
 * value and returns from it the value corresponding to the kuery.
 *
 * @param {*} prop
 * @param {Object} livePropLookup
 * @param {Object} liveProps
 * @returns
 *
 * @memberof UIComponent
 */
function _postProcessProp (prop: any, livePropLookup: Object, liveProps: Object,
    name: string, component: UIComponent) {
  if ((typeof prop !== "object") || (prop === null)) return undefined;
  if (prop instanceof Kuery) {
    let ret = livePropLookup.get(prop.kueryId());
    if (ret === undefined) {
      const liveKueryName = `props#${liveProps.currentIndex++}.${name}`;
      liveProps[liveKueryName] = prop;
      ret = function fetchLiveProp (livePropValues: OrderedMap) {
        try {
          return livePropValues.get(liveKueryName);
        } catch (error) {
          throw wrapError(error, `During fetchLiveProp(${liveKueryName}), with:`,
              "\n\tkueryId:", ret.kueryId,
              "\n\tname:", name,
              "\n\tcomponent:", component.debugId());
        }
      };
      ret.kueryId = prop.kueryId();
      livePropLookup.set(prop.kueryId(), ret);
    }
    return ret;
  }
  if (!Array.isArray(prop)
      && ((Object.getPrototypeOf(prop) !== Object.prototype) || React.isValidElement(prop))) {
    // Only recurse plain arrays and objects.
    return undefined;
  }
  let modifications: any;
  for (const key of Object.keys(prop)) {
    const postProcessedValue =
        _postProcessProp(prop[key], livePropLookup, liveProps, name, component);
    if (typeof postProcessedValue !== "undefined") {
      (modifications || (modifications = new Map())).set(key, postProcessedValue);
    }
  }
  if (!modifications) return undefined;
  const ret = (livePropValues: OrderedMap) => {
    const innerRet = Array.isArray(prop) ? [...prop] : { ...prop };
    modifications.forEach((value: any, key: any) => { innerRet[key] = value(livePropValues); });
    return innerRet;
  };
  ret.kueryId = true;
  return ret;
}

export function _validateElement (component: UIComponent, element: any) {
  return _recurseValidateElements(element);
}

function _recurseValidateElements (element: any) {
  if ((typeof element !== "object") || (element == null)) return undefined;
  if (Array.isArray(element)) {
    const faults = element.map(_recurseValidateElements);
    return typeof faults.find(entry => typeof entry !== "undefined") !== "undefined"
        ? faults
        : undefined;
  }
  if (!React.isValidElement(element)) {
    return {
      elementFault: `non-react component objects (got ${
          (element.constructor || { name: "unknown" }).name}) are not valid render result elements`,
    };
  }
  const ret = {};
  if (typeof element.key === "undefined") ret.keyFault = "key missing";
  if ((typeof element.type !== "string") && (typeof element.type !== "function")
      && ((typeof element.type !== "object") || !(element.type instanceof React.Component))) {
    ret.typeFault = `type must be string, function or React.Component, got ${
        debugId(element.type)}`;
  }
  if (!element.type.isUIComponent) {
    // Only iterate children if the component is not an UIComponent.
    const childFaults = _recurseValidateElements((element.props || {}).children);
    if (typeof childFaults !== "undefined") ret.childFaults = childFaults;
  }
  if (!Object.keys(ret).length) return undefined;
  ret.element = element;
  return ret;
}
