// @flow

import React from "react";

import { Kuery } from "~/raem/VALK";
import { IsLiveTag } from "~/engine/VALEK";

import UIComponent, { isUIComponentElement } from "./UIComponent";
import { createComponentKey } from "./_propsOps";
import { getScopeValue } from "./scopeValue";

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
    component: UIComponent, element: Object, focus: any, hierarchyKey?: string) {
  // TODO(iridian, 2020-06): This whole setup should be implemented in
  // JSXDecoder also, then deprecated here, and finally removed from
  // here.
  const LiveProps = _LiveProps || (_LiveProps = require("./LiveProps").default);

  if ((element.type === LiveProps)
      || LiveProps.isPrototypeOf(element.type)) return undefined;
  let livePropsArgs = element[LivePropsPropsTag];
  try {
    if (livePropsArgs === undefined) {
      let extendedProps;
      if (element.key) (extendedProps = []).push(["key", element.key]);
      if (element.ref) (extendedProps || (extendedProps = [])).push(["$on.ref", element.ref]);
      livePropsArgs = tryCreateLivePropsArgs(
          element.type, extendedProps || Object.entries(element.props), hierarchyKey);
    }
    if (livePropsArgs) {
      // console.log("tryWrapElementInLiveProps LiveWrapper for", elementType.name, wrapperProps);
      /* Only enable this section for debugging React key warnings; it
      will break react elsewhere
      const DebugLiveProps = class DebugLiveProps extends LiveProps {};
      Object.defineProperty(DebugLiveProps, "name", {
        value: `LiveProps_${livePropsProps.key}`,
      });
      // */
      return React.createElement(...livePropsArgs, ...arrayFromAny(element.props.children));
    }
    // Element has no live props.
    // let parentUIContext;
    let children;
    if (isUIComponentElement(element)) {
      // const hasUIContext = props.parentUIContext;
      // If an UIComponent element isn't provided a parentUIContext
      // explicitly then the current component context is provided as
      // the parentUIContext.
      // if (!hasUIContext) parentUIContext = component.getUIContext();
      // Otherwise if the UIComponent has a key no pre-processing
      // is required now. UIComponent does its own post-processing.
      // else
      if (key || !lensName) return undefined;
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
    // if (parentUIContext) newProps.parentUIContext = parentUIContext;
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

export function tryCreateLivePropsArgs (elementType, props, key, ref, component, lensName) {

const _genericLivePropsBehaviors = {
  children: false, // ignore
  ref: "$on:ref",
  valoscope: true, // always trigger liveprops handling
  array: UIComponent,
};

export function tryCreateLivePropsArgs (elementType, propsSeq, hierarchyKey) {
  const LiveProps = _LiveProps || (_LiveProps = require("./LiveProps").default);

  const propsKueries = { currentIndex: 0 };
  // TODO(iridian, 2020-06): Fix this ridiculously useless deduplication
  // idea (of my own). Both coders themselves as well as the live kuery
  // system itself will deduplicate any live props there might be.
  const kueryDeduper = new Map();
  let kueryProps;
  const livePropsBehaviors = elementType.livePropsBehaviors || _genericLivePropsBehaviors;
  try {
    for (const [propName, propValue] of propsSeq) {
      let actualName = propName;
      const behavior = livePropsBehaviors[propName];
      if (behavior !== undefined) {
        if (typeof behavior === "boolean") {
          if (behavior === false) continue;
        } else if (typeof behavior === "string") {
          actualName = behavior;
        } else if (behavior === UIComponent) {
          if (!elementType.isUIComponent) continue;
        }
        kueryProps = {};
      }
      const newProp = _postProcessProp(propValue, propsKueries, actualName, kueryDeduper);
      if (newProp !== undefined) {
        (kueryProps || (kueryProps = {}))[actualName] = newProp;
      }
    }
    if (!kueryProps) return undefined;
    const livePropsProps = { elementType, elementPropsSeq: [...Object.entries(kueryProps)] };
    for (const [propName, propValue] of propsSeq) {
      if (kueryProps[propName] === undefined) {
        livePropsProps.elementPropsSeq.push([propName, propValue]);
      }
    }
    if (propsKueries.currentIndex) {
      delete propsKueries.currentIndex;
      livePropsProps.propsKueriesSeq = [...Object.entries(propsKueries)];
    }
    return [LiveProps, livePropsProps];
  } catch (error) {
    throw wrapError(error, `During _createLivePropsProps(`,
            typeof elementType === "function" ? elementType.name : elementType, `), with:`,
        "\n\telement.props:", propsSeq,
    );
  }
}

/**
 * Converts all VALK kuery objects in properties into kuery placeholder
 * callback functions and adds the kueries as entries to the new
 * propsKueries prop.
 * The kuery placeholder callback takes a kueryValues object which is
 * a map from kueryId to a value and returns from it the value
 * corresponding to the kuery.
 *
 * @param {*} prop
 * @param {Object} propsKueries
 * @param {Object} name
 * @param {Object} kueryDeduper
 * @returns
 *
 * @memberof UIComponent
 */
function _postProcessProp (prop: any, propsKueries: Object, name: string, kueryDeduper: Object,
    parentFetchedKueryNames: ?Array) {
  if ((typeof prop !== "object") || (prop === null)) return undefined;
  if (prop instanceof Kuery) {
    let ret = kueryDeduper.get(prop.kueryId());
    if (!ret) {
      const kueryName = `props.${name}#${propsKueries.currentIndex++}`;
      propsKueries[kueryName] = prop;
      ret = _createFetchKueryProp(kueryName);
      ret.fetchedKueryNames = [kueryName];
      if (parentFetchedKueryNames) parentFetchedKueryNames.push(kueryName);
      kueryDeduper.set(prop.kueryId(), ret);
    }
    return ret;
  }
  if (!Array.isArray(prop)
      && ((Object.getPrototypeOf(prop) !== Object.prototype) || React.isValidElement(prop))) {
    // Only recurse plain arrays and objects.
    return undefined;
  }
  let modifications: any;
  const fetchedKueryNames = parentFetchedKueryNames || [];
  for (const key of Object.keys(prop)) {
    const postProcessedValue = _postProcessProp(
        prop[key], propsKueries, name, kueryDeduper, fetchedKueryNames);
    if (postProcessedValue !== undefined) {
      (modifications || (modifications = new Map())).set(key, postProcessedValue);
    }
  }
  if (!modifications) return undefined;
  const ret = (kueryValues: Object) => {
    const innerRet = Array.isArray(prop) ? [...prop] : { ...prop };
    modifications.forEach((value: any, key: any) => { innerRet[key] = value(kueryValues); });
    return innerRet;
  };
  ret.fetchedKueryNames = fetchedKueryNames;
  return ret;
}

function _createFetchKueryProp (kueryName: string) {
  return function _fetchKueryProp (kueryValues: Object) {
    try {
      return kueryValues[kueryName];
    } catch (error) {
      throw wrapError(error, `During _fetchKueryProp(${kueryName})`);
    }
  };
}
