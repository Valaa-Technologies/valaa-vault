// @flow

import React from "react";

import { Kuery } from "~/raem/VALK";

import Vrapper from "~/engine/Vrapper";
import VALEK from "~/engine/VALEK";
import debugId from "~/engine/debugId";

import { arrayFromAny, isPromise, isSymbol, thenChainEagerly, thisChainEagerly } from "~/tools";

import UIComponent from "./UIComponent";
import { createComponentKey } from "./_propsOps";

import { wrapElementInLiveProps, tryWrapElementInLiveProps } from "./_livePropsOps";

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
    const key = keyFromFocus
        ? keyFromFocus(focus, arrayIndex)
        : createComponentKey(parentKey, focus, arrayIndex);
    const props = {
      ...entryProps,
      focus,
      parentUIContext,
      context: { ...(entryProps.context || {}), forIndex: arrayIndex, arrayIndex },
      key,
      lensId: key,
    };
    return wrapElementInLiveProps(
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
  if (ret !== undefined) return ret;
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
    if (processedEntry !== undefined) {
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
    lensName: string, onlyIfAble?: boolean, onlyOnce?: boolean, vInterpreterProperty?: Vrapper,
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
        return tryWrapElementInLiveProps(component, lens, focus, lensName);
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
        if (lens.getTypeName() === "Property") {
          return _tryRenderPropertyLens(component, lens, focus, lensName);
        }
        if (lens.getTypeName() === "Media") {
          ret = _tryRenderMediaLens(component, lens, focus, lensName, vInterpreterProperty);
          subLensName = `~-${lensName}`;
        } else {
          const valos = component.getValos();
          subLensName = `<-${lensName}`;
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
        subLensName = `-ns-${lensName}`;
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
      return wrapElementInLiveProps(component, resolvedRet, focus, subLensName);
    }
    if (onlyOnce) return resolvedRet;
    return component.renderLens(resolvedRet, focus, subLensName);
  });
}

function _tryRenderPropertyLens (component, vProperty, focus, lensName) {
  const bindingSlot = `UIComponent_property_${lensName}`;
  if (!component.getBoundSubscription(bindingSlot)) {
    component.bindLiveKuery(bindingSlot, vProperty, "value", {
      scope: component.getUIContext(),
      onUpdate: function onLensPropertyValueUpdate () {
        if (component.tryFocus() !== focus) return false;
        component.forceUpdate();
        return undefined;
      },
      updateImmediately: false,
    });
  }
  return _tryRenderLens(
      component, vProperty.extractValue(), focus, `.-${lensName}`, undefined, undefined, vProperty);
}

function _tryRenderMediaLens (
    component: UIComponent, media: any, focus: any, lensName, vInterpreterProperty: ?Vrapper) {
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
  const ret = thisChainEagerly(
      { lens: media, options: { fallbackContentType: "text/vsx", vInterpreterProperty } },
      null,
      _renderMediaLensChain,
      function errorOnRenderMediaLens (error) {
        if (!error.slotName) error.slotName = "mediaInterpretationErrorLens";
        error.media = media;
        error.mediaInfo = this.mediaInfo;
        throw error;
      });
  if (isPromise(ret)) {
    ret.operationInfo = Object.assign(ret.operationInfo || {}, {
      slotName: "pendingMediaInterpretationLens", focus: media,
    });
  }
  return ret;
}

const _renderMediaLensChain = [
  function _interpretMediaContent () {
    return [this.lens.interpretContent(this.options)];
  },
  function _postProcessInterpretedMediaContent (contentInterpretation) {
    let error;
    const info = this.options.mediaInfo || this.lens.resolveMediaInfo();
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
      return [contentInterpretation];
    } else if (contentInterpretation instanceof Error) {
      error = contentInterpretation;
    } else {
      error = new Error(`Media '${info.name}' interpretation as '${
          info.contentType}' resolves into a complex type ${
          (contentInterpretation.constructor || {}).name || "<unnamed>"}`);
    }
    error.slotName = "unrenderableMediaInterpretationLens";
    throw error;
  },
];

export function _validateElement (element: any) {
  return _recurseValidateElements(element);
}

function _recurseValidateElements (element: any) {
  if ((typeof element !== "object") || (element == null)) return undefined;
  if (Array.isArray(element)) {
    const faults = element.map(_recurseValidateElements);
    return faults.find(entry => entry !== undefined) !== undefined
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
  if (element.key === undefined) ret.keyFault = "key missing";
  if ((typeof element.type !== "string") && (typeof element.type !== "function")
      && ((typeof element.type !== "object") || !(element.type instanceof React.Component))) {
    ret.typeFault = `type must be string, function or React.Component, got ${
        debugId(element.type)}`;
  }
  if (!element.type.isUIComponent) {
    // Only iterate children if the component is not an UIComponent.
    const childFaults = _recurseValidateElements((element.props || {}).children);
    if (childFaults !== undefined) ret.childFaults = childFaults;
  }
  if (!Object.keys(ret).length) return undefined;
  ret.element = element;
  return ret;
}
