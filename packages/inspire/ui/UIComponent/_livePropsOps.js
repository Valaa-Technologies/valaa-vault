// @flow

import React from "react";
import { OrderedMap } from "immutable";

import { Kuery } from "~/raem/VALK";

import UIComponent, { isUIComponentElement } from "./UIComponent";
import { uiComponentProps } from "./_propsOps";

import { arrayFromAny, isPromise, wrapError } from "~/tools";

export const LivePropsPropsTag = Symbol("LiveProps.props");

export function wrapElementInLiveProps (component: UIComponent, element: Object, focus: any,
    name?: string) {
  const ret = tryWrapElementInLiveProps(component, element, focus, name);
  return (ret !== undefined) ? ret : element;
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
export function tryWrapElementInLiveProps (
    component: UIComponent, element: Object, focus: any, lensName?: string) {
  // TODO(iridian, 2020-06): This whole setup should be implemented in
  // JSXDecoder also, then deprecated here, and finally removed from
  // here.
  const LiveProps = _LiveProps || (_LiveProps = require("./LiveProps").default);

  if ((element.type === LiveProps)
      || LiveProps.isPrototypeOf(element.type)) return undefined;
  const { type: elementType, props, ref, key } = element;
  let livePropsProps = element[LivePropsPropsTag];
  if (livePropsProps === undefined) {
    livePropsProps = tryCreateLivePropsProps(elementType, props, ref);
  }
  try {
    if (livePropsProps) {
      // console.log("tryWrapElementInLiveProps LiveWrapper for", elementType.name, wrapperProps);
      /* Only enable this section for debugging React key warnings; it
      will break react elsewhere
      const DebugLiveProps = class DebugLiveProps extends LiveProps {};
      Object.defineProperty(DebugLiveProps, "name", {
        value: `LiveProps_${livePropsProps.key}`,
      });
      // */
      return React.createElement(
          LiveProps,
          uiComponentProps({
            name: (typeof key === "string") ? `!${key}`
                : key ? `!.-${lensName}`
                : lensName,
            parentUIContext: component.getUIContext(),
          }, { ...livePropsProps }),
          ...arrayFromAny(props.children));
    }
    // Element has no live props.
    let parentUIContext;
    let children;
    if (isUIComponentElement(element)) {
      const hasUIContext = props.uiContext || props.parentUIContext;
      // If an UIComponent element doesn't have a UIContext then the
      // current component context is provided as the parentUIContext
      // for the child component component.
      if (!hasUIContext) parentUIContext = component.getUIContext();
      // Otherwise if the UIComponent has a key no pre-processing
      // is required now. UIComponent does its own post-processing.
      else if (key || !lensName) return undefined;
    } else {
      // non-UIComponent sans live props has its children directly rendered.
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
    return React.createElement(
        elementType,
        newProps,
        ...(children || arrayFromAny(props.children)));
  } catch (error) {
    throw wrapError(error, `During ${component.debugId()}\n .tryWrapElementInLiveProps(`,
            typeof elementType === "function" ? elementType.name : elementType, `), with:`,
        "\n\telement.props:", props,
        "\n\telement.props.children:", props && props.children,
    );
  }
}

export function tryCreateLivePropsProps (elementType, props, ref) {
  let elementProps;
  const liveProps = { currentIndex: 0 };
  // TODO(iridian, 2020-06): Fix this ridiculously useless deduplication
  // idea (of my own). Both coders themselves as well as the live kuery
  // system itself will deduplicate any live props there might be.
  const livePropLookup = new Map(); // deduplicate identical kueries
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
      const newProp = _postProcessProp(props[propName], livePropLookup, liveProps, propName);
      if (newProp !== undefined) {
        _obtainLiveElementProps()[propName] = newProp;
      } else if ((propName === "valoscope")
          || ((propName === "array") && elementType.isUIComponent)) {
        _obtainLiveElementProps();
      }
    }
    if (ref && (ref instanceof Kuery)) {
      // Rewrite ref kuery as onRefKuery so that LiveProps can evaluate it.
      _obtainLiveElementProps().onRef =
          _postProcessProp(ref, livePropLookup, liveProps, "ref");
      delete elementProps.ref;
    }
    if (!elementProps) return undefined;
    const ret = { elementType, elementProps };
    if (liveProps.currentIndex) {
      delete liveProps.currentIndex;
      ret.liveProps = liveProps;
    }
    return ret;
  } catch (error) {
    throw wrapError(error, `During _createLivePropsProps(`,
            typeof elementType === "function" ? elementType.name : elementType, `), with:`,
        "\n\telement.props:", props,
        "\n\telement.props.children:", props && props.children,
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
function _postProcessProp (prop: any, livePropLookup: Object, liveProps: Object, name: string) {
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
              "\n\tname:", name);
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
    const postProcessedValue = _postProcessProp(prop[key], livePropLookup, liveProps, name);
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
