// @flow
import React from "react";
import isEqual from "lodash.isequal";

import { SourceInfoTag } from "~/raem/VALK/StackTrace";

import Vrapper from "~/engine/Vrapper";

import Lens from "~/inspire/ui/Lens";

import { invariantifyObject, wrapError } from "~/tools";

import type UIComponent from "./UIComponent";
import { getScopeValue } from "./scopeValue";

export function createComponentKey (parentKey: string, focus: any, index?: any): string {
  return (focus instanceof Vrapper) ? `${focus.getBriefUnstableId()}<-${parentKey}`
      : index !== undefined ? `[${index}]${parentKey}`
      : `-${parentKey}`;
}

export function _childProps (component: UIComponent, name: string, targetProps: Object) {
  targetProps.parentUIContext = component.getUIContext();
  if (!targetProps.parentUIContext) {
    invariantifyObject(targetProps.parentUIContext,
      "uiComponentProps.parentUIContext (when no .uiContext is given)", { allowEmpty: true });
  }
  targetProps.context = targetProps.context || {};
  if (!targetProps.context.key) {
    targetProps.context.key = createComponentKey(name || "",
        getScopeValue(targetProps.uiContext || targetProps.parentUIContext, "focus"));
  }
  targetProps.key = targetProps.context.key;
  return targetProps;
}

export function _checkForInfiniteRenderRecursion (component: UIComponent) {
  let context = component.state.uiContext;
  if (!context || !context.focus) return false;
  const depth = context[Lens.currentRenderDepth];
  if ((depth !== undefined) && (depth < context[Lens.infiniteRecursionCheckWaterlineDepth])) {
    return false;
  }
  const newFocus = component.getFocus();
  const newKey = component.getUIContextValue("key");
  // eslint-disable-next-line
  while ((context = Object.getPrototypeOf(context))) {
    if (context.key !== newKey || !context.reactComponent
        || (context.reactComponent.constructor !== component.constructor)) {
      continue;
    }
    if (context.focus !== newFocus) {
      continue;
    }
    if (_comparePropsOrState(context.reactComponent.props, component.props, "onelevelshallow",
        component.constructor.propsCompareModesOnComponentUpdate, "props")) {
      continue;
    }
    console.log("Infinite render recursion match found in component", component,
            component.state.uiContext,
        "\n\tancestor props:", context.reactComponent.props,
        "\n\telement props:", component.props);
    const currentContext = Object.assign(
        Object.create(Object.getPrototypeOf(component.state.uiContext)),
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
    component.enableError(error, "UIComponent._checkForInfiniteRenderRecursion");
    return true;
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
    if (left[SourceInfoTag] || right[SourceInfoTag]) return false;
  }
  return undefined;
}
