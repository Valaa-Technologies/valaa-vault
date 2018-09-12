// @flow

import React from "react";
import { OrderedMap } from "immutable";

import { Kuery } from "~/raem/VALK";

import Vrapper from "~/engine/Vrapper";
import VALEK from "~/engine/VALEK";
import debugId from "~/engine/debugId";

import { arrayFromAny, isPromise, isSymbol, wrapError } from "~/tools";

import UIComponent, { isUIComponentElement } from "./UIComponent";
import { uiComponentProps } from "./_propsOps";

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

export function _locateLensRoleAssignee (component: UIComponent,
    roleName: string, roleSymbol: Symbol, focus: any, onlyIfAble?: boolean):
    void | null | string | React.Element<any> | [] | Promise<any> {
  if (onlyIfAble) {
    const descriptor = component.context.engine.getHostObjectDescriptor(roleSymbol);
    if (descriptor
        && (typeof descriptor.isLensAvailable === "function")
        && !descriptor.isLensAvailable(focus, component)) {
      return undefined;
    }
  }
  let assignee;
  try {
    assignee = component.props[roleName];
    if (typeof assignee === "undefined") {
      if (component.props.hasOwnProperty(roleName)) {
        throw new Error(`Render role props.${roleName} is provided but its value is undefined`);
      }
      assignee = component.getUIContextValue(roleSymbol);
      if (typeof assignee === "undefined") {
        assignee = component.context[roleName];
        if (typeof assignee === "undefined") return undefined;
      } else if (Array.isArray(assignee) && !Object.isFrozen(assignee)) {
        assignee = [...assignee]; // the lens chain constantly mutates assignee, return a copy
      }
    }
    return assignee;
  } catch (error) {
    throw wrapError(error,
        `During ${component.debugId()}\n ._locateLensRoleAssignee, with:`,
        "\n\tfocus:", focus,
        "\n\troleName:", roleName,
        "\n\troleSymbol:", roleSymbol,
        "\n\tassignee:", assignee);
  }
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
        : (focus instanceof Vrapper) ? `@${focus.getRawId().slice(0, 13)}<-${parentKey}`
        : `[${typeof arrayIndex !== "undefined" ? arrayIndex : "-"}]${parentKey}`;
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
    return component.renderLensSequence(component.props.children, focus);
  }
  const preRendered = component.preRenderFocus(focus);
  const ret = component.tryRenderLens(preRendered, focus, "renderRoot");
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

let _ValaaScope;

export function _tryRenderLens (component: UIComponent, lens: any, focus: any,
    lensName: string, onlyIfAble?: boolean, onlyOnce?: boolean,
): void | null | string | React.Element<any> | [] | Promise<any> {
  if (!_ValaaScope) _ValaaScope = require("../ValaaScope").default;

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
      } else if (lens instanceof Kuery) {
        // Delegates the kuery resolution to LiveProps.
        subLensName = `kuery-${lensName}`;
        ret = React.createElement(UIComponent,
            component.childProps(subLensName, {}, { delegate: [lens] }));
      } else if (lens instanceof Vrapper) {
        const blocker = lens.activate();
        if (blocker) {
          blocker.operationInfo = Object.assign(blocker.operationInfo || {},
              { lensRole: "pendingConnectionsLens" });
          return blocker;
        }
        if (lens.hasInterface("Media")) {
          ret = _tryRenderMediaLens(component, lens, focus, lensName);
          if (isPromise(ret)) {
            ret.operationInfo = Object.assign(ret.operationInfo || {},
                { lensRole: "downloadingLens", params: lens });
            return ret;
          }
          subLensName = `media-${lensName}`;
        } else {
          console.warn("NEW BEHAVIOUR: non-Media Resources as direct lenses are now in effect.",
              "When a Resource is used as a lens, it will be searched for a lens property",
              "and if found the lens property will be used _while retaining the original focus,",
              "which likely is not necessarily the lens Resource itself",
              "\n\tin component:", component.debugId(), component);
          const Valaa = component.getValaa();
          subLensName = `delegate-lens-${lensName}`;
          ret = _locateLensRoleAssignee(component, "delegatePropertyLens",
              Valaa.Lens.delegatePropertyLens, lens, true)(
                  lens, component, lensName);
          if (ret == null || ((ret.delegate || [])[0] === Valaa.Lens.notLensResourceLens)) {
            return component.renderLensRole("notLensResourceLens", lens, subLensName);
          }
        }
        /*
        console.error("DEPRECATED, SUBJECT TO CHANGE:",
            "VSX notation `{focus.foo}` sets focus.foo as the new focus, for now",
            "\n\tprefer: `{{ focus: focus.foo }}` (ie no-scope syntax) to set focus",
            "\n\tchange: the compact notation will be used for rendering focus.foo",
            "as a _lens_, WITHOUT changing the focus.",
            "\n\tin component:", component.debugId(), component);
        return React.createElement(_ValaaScope,
            component.childProps(`legacy-focus-${lensName}`, { focus: lens }, {}));
        */
      } else if (Array.isArray(lens)) {
        return _tryRenderLensArray(component, lens, focus);
      } else if (Object.getPrototypeOf(lens) === Object.prototype) {
        if (lens.delegate && (Object.keys(lens).length === 1)) {
          return _renderFirstAbleDelegate(component, lens.delegate, focus, lensName);
        }
        subLensName = `-noscope-${lensName}`;
        ret = React.createElement(_ValaaScope, component.childProps(subLensName, {}, { ...lens }));
      } else if (isSymbol(lens)) {
        return component.renderLensRole(lens, focus, undefined, onlyIfAble, onlyOnce);
      } else {
        throw new Error(`Invalid lens value when trying to render ${lensName
            }, got value of type '${lens.constructor.name}'`);
      }
      break;
    case "symbol":
      return component.renderLensRole(lens, focus, undefined, onlyIfAble, onlyOnce);
  }
  if (React.isValidElement(ret)) return _wrapElementInLiveProps(component, ret, focus, subLensName);
  if ((ret === undefined) || onlyOnce) return ret;
  return component.renderLens(ret, focus, subLensName);
}

function _tryRenderMediaLens (component: UIComponent, lens: any, focus: any) {
  const kueryKey = `UIComponent.media.${lens.getRawId()}`;
  if (!component.getSubscriber(kueryKey)) {
    component.attachKuerySubscriber(kueryKey, lens, VALEK.toMediaContentField(), { onUpdate: () => {
      // detaches the live kuery
      // this is likely uselessly defensive programming: the whole UIComponent state should refresh
      // anyway whenever the focus changes.
      if (component.tryFocus() !== focus) return false;
      component.forceUpdate();
      return undefined;
    } });
  }
  let content = lens.interpretContent({ mimeFallback: "text/vsx" });
  if ((content != null) && content.__esModule) {
    content = content.default;
    if (content === undefined) {
      throw new Error(`Can't find default export from media '${lens.debugId()}'`);
    }
  }
  return content;
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
      if (typeof newProp !== "undefined") {
        _obtainLiveElementProps()[propName] = newProp;
      } else if ((propName === "valaaScope")
          || ((propName === "array") && isUIComponentElement(element))) {
        _obtainLiveElementProps();
      }
    }
    if (ref && (ref instanceof Kuery)) {
      // Rewrite ref kuery as refKuery so that LiveProps can evaluate it.
      _obtainLiveElementProps().refKuery =
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
        children = component.tryRenderLensSequence(props.children, focus);
        if ((key || !lensName) && (children === undefined)) return undefined;
        if (isPromise(children)) {
          children.operationInfo = Object.assign(children.operationInfo || {},
              { lensRole: "pendingChildrenLens", params: props.children });
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
      name: (typeof key === "string") ? `live-${key}`
          : key ? `livekeyed-${lensName}`
          : lensName,
      parentUIContext: component.getUIContext(),
    }, livePropsProps);
    // console.log("_tryWrapElementInLiveProps LiveWrapper for", elementType.name, wrapperProps);
    /* Only enable this section for debugging React key warnings; it will break react elsewhere
    const DebugLiveProps = class DebugLiveProps extends LiveProps {};
    Object.defineProperty(DebugLiveProps, "name", {
      value: `LiveProps_${livePropsProps.key}`,
    });
    //*/
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
    if (typeof ret === "undefined") {
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

