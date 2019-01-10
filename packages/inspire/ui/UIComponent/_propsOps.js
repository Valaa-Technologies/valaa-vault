// @flow
import React from "react";
import isEqual from "lodash.isequal";

import { Kuery } from "~/raem/VALK";

import Vrapper from "~/engine/Vrapper";

import { invariantify, invariantifyObject, outputError, wrapError } from "~/tools";

import type UIComponent from "./UIComponent";
import { getScopeValue } from "./scopeValue";

type UIComponentPropsOptions = {
  name?: string, index?: any, uiContext?: Object,
  parentUIContext?: Object, focus?: any, head?: any, kuery?: any
};
export function uiComponentProps (
    options: UIComponentPropsOptions = {},
    props?: Object = {},
) {
  const focus = options.hasOwnProperty("focus") ? options.focus : options.head;
  invariantify((typeof focus !== "undefined")
      || (!options.hasOwnProperty("focus") && !options.hasOwnProperty("head")),
      "uiComponentProps.focus value must not be undefined if 'focus' is a key in the props");
  if (options.uiContext) {
    invariantify(!options.parentUIContext && !options.kuery && (typeof focus === "undefined"),
        "uiComponentProps.focus and .kuery must be undefined when .uiContext is defined");
    props.uiContext = options.uiContext;
  } else {
    invariantifyObject(options.parentUIContext,
        "uiComponentProps.parentUIContext (when no .uiContext is given)", { allowEmpty: true });
    props.parentUIContext = options.parentUIContext;
    if (typeof focus !== "undefined") props.focus = focus;
    if (typeof options.kuery !== "undefined") props.kuery = options.kuery;
  }
  props.context = Object.assign(props.context || {}, options.context);
  if (!props.context.key) {
    props.context.key = _createComponentKey(options.name || "",
        focus || getScopeValue(props.uiContext || props.parentUIContext, "focus"),
        options.index);
  }
  props.key = props.context.key;
  return props;
}

export function _createComponentKey (name: string, focus: any, index?: any): string {
  const uniqueId = (focus instanceof Vrapper) && focus.getRawId();
  return uniqueId
      ? `${name}-@${uniqueId.slice(0, 13)}`
      : `${name}-#${typeof index !== "undefined" ? index : "-"}`;
}

export function _childProps (component: UIComponent, name: string,
    options: { index?: any, kuery?: Kuery, head?: any, focus?: any, context?: Object },
    initialProps: Object,
) {
  const parentUIContext = component.getUIContext();
  invariantify(!options.uiContext, `childProps.options.uiContext must be undefined`);
  invariantify(parentUIContext, `childProps can only be called if getUIContext() is valid`);
  const nextOptions = { parentUIContext, name, ...options };
  if (nextOptions.hasOwnProperty("head")) {
    console.error("DEPRECATED: props.head\n\tprefer: props.focus");
    nextOptions.focus = nextOptions.head;
    delete nextOptions.head;
  }
  invariantify((typeof nextOptions.focus !== "undefined") || (!nextOptions.hasOwnProperty("focus")),
      "childProps.focus must not be undefined if it is specified as an option");
  return uiComponentProps(nextOptions, initialProps);
}

export function _checkForInfiniteRenderRecursion (component: UIComponent) {
  if (!component.state.uiContext || !component.state.uiContext.focus) return false;
  let context = component.state.uiContext;
  const newFocus = component.getFocus();
  const newKey = component.getUIContextValue("key");
  // eslint-disable-next-line
  while ((context = Object.getPrototypeOf(context))) {
    if ((context.focus === newFocus) && (context.key === newKey)
        && context.reactComponent && (context.reactComponent.constructor === component.constructor)
        && !_comparePropsOrState(context.reactComponent.props, component.props, "onelevelshallow",
            component.constructor.propsCompareModesOnComponentUpdate, "props")) {
      console.log("Infinite render recursion match found in component", component,
              component.state.uiContext,
          "\n\tancestor props:", context.reactComponent.props,
          "\n\telement props:", component.props);
      const currentContext =
          Object.assign(Object.create(Object.getPrototypeOf(component.state.uiContext)),
              component.state.uiContext);
      const error = wrapError(new Error("Infinite component render recursion detected"),
          `Exception caught in ${
              component.debugId()})\n ._checkForInfiniteRenderRecursion(), with:`,
          "\n\tcurrent component UI context:", currentContext,
          "\n\tnew candidate focus:", newFocus && newFocus.debugId(), newFocus,
          "\n\tnew candidate key:", newKey,
          "\n\tnew candidate props:", component.props,
          "\n\tidentical ancestor UI context:", context,
          "\n\tidentical ancestor focus:", context.focus.debugId(), context.focus,
          "\n\tidentical ancestor props:", context.reactComponent.props,
      );
      outputError(error, "Exception caught during UIComponent._checkForInfiniteRenderRecursion");
      component.enableError(error);
      return true;
    }
  }
  return false;
}

export function _comparePropsOrState (leftObject: any, rightObject: any, defaultEntryCompare: any,
    entryCompares: any = {}, type: any, verbosity: any
) {
  const simplyEqual = _isSimplyEqual(leftObject, rightObject);
  if (simplyEqual !== undefined) return !simplyEqual;

  const leftKeys = Object.keys(leftObject);
  const rightKeys = Object.keys(rightObject);
  if (leftKeys.length !== rightKeys.length) {
    /*
    if (verbosity) {
      console.info(type, "key counts differ:",
          leftKeys.length, rightKeys.length, leftKeys, rightKeys);
    }
    */
    return true;
  }
  for (const key of leftKeys) {
    if (!rightObject.hasOwnProperty(key)) {
      /*
      if (verbosity) {
        console.info(type, "right side missing key:", key);
      }
      */
      return true;
    }
    const entryMode = entryCompares[key] || defaultEntryCompare;
    if (entryMode === "ignore") continue;
    const left = leftObject[key];
    const right = rightObject[key];
    const _isSubSimplyEqual = _isSimplyEqual(left, right);
    if (_isSubSimplyEqual === true) continue;
    if (_isSubSimplyEqual === false) return true;
    if (entryMode === "shallow") {
      /*
      if (verbosity) {
        console.info(type, "shallow objects differ:", key, left, right);
      }
      */
      return true;
    }
    if (entryMode === "onelevelshallow") {
      if (!_comparePropsOrState(left, right, "shallow", entryCompares, undefined, verbosity)) {
        continue;
      }

      /*
      if (verbosity) {
        console.info(type, "onelevelshallow objects differ:", key, left, right);
      }
      */
      return true;
    }
    if (!isEqual(left, right)) {
      /*
      if (verbosity) {
        console.info(type, "deep objects differ:", key, left, right);
      }
      */
      return true;
    }
  }
  return false;
}

function _isSimplyEqual (left, right) {
  if (left === right) return true;
  if (typeof left !== typeof right) return false;
  if (typeof left === "function") return (left.name === right.name);
  if ((typeof left !== "object") || (left === null) || (right === null)) return false;
  const isLeftReactElement = React.isValidElement(left);
  if (isLeftReactElement !== React.isValidElement(right)) return false;
  if (isLeftReactElement) {
    if (left._sourceInfo || right._sourceInfo) return false;
  }
  return undefined;
}
