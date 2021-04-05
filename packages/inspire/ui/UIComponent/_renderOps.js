// @flow

import React from "react";

import { Kuery } from "~/raem/VALK";

import Vrapper from "~/engine/Vrapper";
import VALEK from "~/engine/VALEK";
import debugId from "~/engine/debugId";

import {
  arrayFromAny, iterableFromAny, isPromise, isSymbol, thenChainEagerly, thisChainEagerly,
} from "~/tools";

import UIComponent from "./UIComponent";

import { createDynamicKey } from "./_propsOps";
import { wrapElementInValens, tryWrapElementInValens, postRenderElement } from "./_valensOps";

const { symbols: Lens } = require("~/inspire/Lens");

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
    foci: any[], EntryElement: Object, entryPropsTemplate: Object, entryChildren: ?Array,
    options: {
      keyFromFocus: (focus: any, index: number, entryProps: ?Object) => string,
      renderRejection?: (focus: any, index: number) => undefined | any,
      offset?: number,
      limit?: number,
      sort?: (leftFocus: any, rightFocus: any, leftAttrs: Object, rightAttrs: Object) => number,
      onlyPostRender?: Boolean,
      setEndOffset?: Boolean,
    } = {},
): [] {
  // Wraps the focus entries EntryElement, which is UIComponent by default.
  // Rendering a sequence focus can't be just a foci.map(_renderFocus) because individual entries
  // might have pending kueries or content downloads.
  // const parentUIContext = component.getUIContext();
  let arrayIndex = 0, targetIndex = 0;
  const sourceArray = iterableFromAny(foci);
  const ret = new Array(sourceArray.length || 0);

  const keyFromFocus = options.keyFromFocus;
  for (const entryFocus of sourceArray) {
    if (arrayIndex >= (options.offset || 0)) {
      const rejection = options.renderRejection && options.renderRejection(entryFocus, arrayIndex);
      if (rejection === undefined) {
        const entryProps = { ...entryPropsTemplate, focus: entryFocus, arrayIndex };
        entryProps.key = !keyFromFocus ? String(arrayIndex)
            : keyFromFocus(entryFocus, arrayIndex, entryProps);
        if (entryChildren !== undefined) entryProps.children = entryChildren;
        ret[targetIndex++] = [entryProps, entryFocus];
      } else if (rejection !== null) {
        ret[targetIndex++] = [{ arrayIndex }, entryFocus, rejection];
      }
    }
    ++arrayIndex;
    if ((options.limit !== undefined) && (targetIndex >= options.limit)) break;
  }
  if (options.sort) {
    ret.sort((typeof options.sort === "function")
        ? !options.reverse
            ? (l, r) => options.sort(l[1], r[1], l[0], r[0])
            : (l, r) => -options.sort(l[1], r[1], l[0], r[0])
        : !options.reverse
            ? _forwardCompares[options.sort] || _forwardCompares[Lens.frame]
            : _reverseCompares[options.sort] || _reverseCompares[Lens.frame]);
  }
  if (options.setEndOffset) {
    component.setUIContextValue(Lens.endOffset, arrayIndex);
  }
  ret.length = targetIndex;
  while (targetIndex--) {
    const [entryProps, focus, preRendered] = ret[targetIndex];
    if (preRendered) ret[targetIndex] = preRendered;
    else {
      if (targetIndex !== entryProps.arrayIndex) {
        entryProps.elementIndex = targetIndex;
      }
      const element = React.createElement(EntryElement, entryProps);
      ret[targetIndex] = options.onlyPostRender
          ? postRenderElement(component, element, focus, entryProps.key)
          : wrapElementInValens(component, element, focus, entryProps.key);
    }
  }
  return ret;
}

const _forwardCompares = {
  [Lens.frame] (l, r) {
    return (l[0].key || "").localeCompare(r[0].key || "");
  },
  [Lens.arrayIndex] (l, r) {
    return (l[0].arrayIndex || 0) - (r[0].arrayIndex || 0);
  },
  /*
  [Lens.focus] (l, r) {
    return (l[0].arrayIndex || 0) - (r[0].arrayIndex || 0);
  },
  */
};

const _reverseCompares = {
  [Lens.frame] (l, r) {
    return -(l[0].key || "").localeCompare(r[0].key || "");
  },
  [Lens.arrayIndex] (l, r) {
    return (r[0].arrayIndex || 0) - (l[0].arrayIndex || 0);
  },
  /*
  [Lens.focus] (l, r) {
    return (l[0].arrayIndex || 0) - (r[0].arrayIndex || 0);
  },
  */
};

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
  const key = component.getKey();
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
        lensArray[i], focus, `[${String(i)}]<-${lensName || ""}`);
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
      const lexicalContext = component.getLexicalContext();
      subLensName = `${lens.name}()<-${lensName}`;
      ret = lens.call(lexicalContext.this, focus, lexicalContext, lensName);
      break;
    }
    case "object":
      if ((lens === null) || isPromise(lens)) {
        return undefined;
      }
      if (React.isValidElement(lens)) {
        return tryWrapElementInValens(component, lens, focus, lensName);
      }
      if (lens instanceof Kuery) {
        subLensName = `§<-${lensName}`;
        const options = { asRepeathenable: "reuse", scope: component.getUIContext() };
        const head = component.getLexicalContextValue("this");
        const initialRepeathenable = component.bindLiveKuery(subLensName, head, lens, options);
        const repeathenableState = options.repeathenableState;
        if (initialRepeathenable) {
          repeathenableState.chain = thenChainEagerly(
              initialRepeathenable,
              update => {
                let newValue = update.value();
                const oldValue = repeathenableState.currentValue;
                if (newValue === undefined) newValue = null;
                if (newValue === oldValue) return;
                repeathenableState.currentValue = newValue;
                if (oldValue !== undefined) component.rerender(subLensName);
              },
          );
        }
        ret = repeathenableState.currentValue;
        if (ret === undefined) {
          ret = repeathenableState.chain || null;
          repeathenableState.currentValue = null;
        }
        // ret = React.createElement(UIComponent,
        //    component.childProps(subLensName, { delegate: [lens] }));
      } else if (lens instanceof Vrapper) {
        const activation = lens.activate();
        if (activation !== lens) {
          activation.operationInfo = Object.assign(activation.operationInfo || {}, {
            slotName: "pendingFocusLens", focus: lens,
            onError: { slotName: "rejectedFocusLens", resource: lens },
          });
          // Ensure that re-render is triggered by top level _render
          return activation.then(() => undefined);
        }
        if (lens.getTypeName() === "Property") {
          return _tryRenderPropertyLens(component, lens, focus, lensName);
        }
        if (lens.getTypeName() === "Media") {
          return _tryRenderMediaLens(component, lens, focus, lensName, vInterpreterProperty);
        }
        subLensName = `<<-${lensName}`;
        ret = component.readSlotValue(
            "delegatePropertyLens", Lens.delegatePropertyLens, lens, true);
        if ((ret == null) || ((ret.delegate || [])[0] === Lens.notLensResourceLens)) {
          return component.renderSlotAsLens("notLensResourceLens", lens, undefined, subLensName);
        }
      } else if (Array.isArray(lens)) {
        return _tryRenderLensArray(component, lens, focus, lensName);
      } else if (Object.getPrototypeOf(lens) === Object.prototype) {
        // noscope lens
        if (lens.delegate && (Object.keys(lens).length === 1)) {
          return _renderFirstAbleDelegate(component, lens.delegate, focus, lensName);
        }
        subLensName = `{}<-${lensName}`;
        const subProps = { ...lens };
        if (!subProps.key) subProps.key = createDynamicKey(component.getUIContextValue("focus"));
        ret = React.createElement(_Valoscope, subProps);
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
      return wrapElementInValens(component, resolvedRet, focus, subLensName);
    }
    if (onlyOnce) return resolvedRet;
    return component.renderLens(resolvedRet, focus, subLensName);
  });
}

function _tryRenderPropertyLens (component, vProperty, focus, lensName) {
  const subLensName = `.<-${lensName}`;
  if (!component.getBoundSubscription(subLensName)) {
    component.bindLiveKuery(subLensName, vProperty, "value", {
      scope: component.getUIContext(),
      onUpdate: function onLensPropertyValueUpdate () {
        if (component.tryFocus() !== focus) return false;
        component.rerender(subLensName);
        return undefined;
      },
      updateImmediately: false,
    });
  }
  return _tryRenderLens(component, vProperty.extractPropertyValue(),
      focus, subLensName, undefined, undefined, vProperty);
}

function _tryRenderMediaLens (component: UIComponent, media: any, focus: any, lensName,
    vInterpreterProperty: ?Vrapper) {
  const bindingSlot = media.getRawId();
  if (!component.getBoundSubscription(bindingSlot)) {
    component.bindLiveKuery(bindingSlot, media, VALEK.toMediaContentField(), {
      onUpdate: function onMediaContentUpdate () {
        // If focus has changed detaches the live kuery. This is likely
        // uselessly defensive programming as the whole UIComponent state
        // should refresh anyway whenever the focus changes. Nevertheless
        // return before triggering forceupdate as we're obsolete.
        if (component.tryFocus() !== focus) return false;
        component.rerender(bindingSlot);
        return undefined;
      },
      updateImmediately: false,
    });
  }
  let vIntegrationScope;
  if (vInterpreterProperty) {
    const engine = component.context.engine;
    const ghostPath = vInterpreterProperty.getVRef().tryGhostPath();
    const baseProperty = !ghostPath ? vInterpreterProperty
        : engine.getVrapper([ghostPath.rootRawId()]);
    vIntegrationScope = baseProperty.step("owner", { discourse: engine.discourse });
  }
  const ret = thisChainEagerly(
      {
        component, media, lensName,
        options: { fallbackContentType: "text/vsx", vIntegrationScope },
      },
      component.maybeDelayed(Lens.pendingMediaLens),
      _renderMediaLensChain,
      function errorOnRenderMediaLens (error) {
        if (!error.slotName) error.slotName = "uninterpretableMediaLens";
        error.media = media;
        error.mediaInfo = this.mediaInfo;
        throw error;
      });
  if (isPromise(ret)) {
    ret.operationInfo = Object.assign(ret.operationInfo || {}, {
      slotName: "pendingMediaLens", focus: media,
    });
  }
  return ret;
}

const _renderMediaLensChain = [
  function _interpretMediaContent () {
    return this.media.interpretContent(this.options);
  },
  function _postProcessInterpretedMediaContent (contentInterpretation) {
    let error;
    const info = this.options.mediaInfo || this.media.resolveMediaInfo();
    if (typeof contentInterpretation !== "object") {
      if (contentInterpretation !== undefined) return contentInterpretation;
      if (!info.contentHash) throw new Error(`Media '${info.name}' $V.content is missing`);
      error = new Error(
          `Media '${info.name}' interpretation as '${info.contentType}' resolves into undefined`);
    } else if (contentInterpretation.__esModule) {
      if (contentInterpretation.default !== undefined) return contentInterpretation.default;
      error = new Error(`Can't find default export from module Media '${info.name}'`);
    } else if (React.isValidElement(contentInterpretation)) {
      const extendContext = { this: this.media };
      if (this.options.vIntegrationScope) {
        extendContext[Lens.integrationScopeResource] = this.options.vIntegrationScope;
      }
      return wrapElementInValens(
          this.component, contentInterpretation, this.focus, `~<-${this.lensName}`, extendContext);
    } else if (Array.isArray(contentInterpretation)
        || (Object.getPrototypeOf(contentInterpretation) === Object.prototype)) {
      error = new Error(`Media '${info.name
          }' interpretation must not return an array or plain old object`);
    } else if (contentInterpretation instanceof Error) {
      error = contentInterpretation;
    } else {
      error = new Error(`Media '${info.name}' interpretation as '${
          info.contentType}' resolves into a complex type ${
          (contentInterpretation.constructor || {}).name || "<unnamed>"}`);
    }
    error.slotName = "unrenderableInterpretationLens";
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
  if (element.key === undefined) ret.keyFault = "key present but undefined";
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
