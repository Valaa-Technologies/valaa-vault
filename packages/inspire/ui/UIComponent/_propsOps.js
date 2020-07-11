// @flow
import React from "react";
import isEqual from "lodash.isequal";

import { SourceInfoTag } from "~/raem/VALK/StackTrace";

import Vrapper from "~/engine/Vrapper";

import Lens from "~/inspire/ui/Lens";

import { wrapError } from "~/tools";

import type UIComponent from "./UIComponent";

/*
 * Create a dynamic key based on the focus if it is a resource,
 * if not, based on the position if it is given, otherwise a fixed
 * value.
 */
export function createDynamicKey (focus, index) {
  return (focus instanceof Vrapper) ? focus.getBriefUnstableId()
      : (index !== undefined) ? String(index)
      : "unfocused";
}

export function _checkForInfiniteRenderRecursion (component: UIComponent) {
  let uiContext = component.state.uiContext;
  if (!uiContext || !uiContext.focus) return false;
  const depth = uiContext[Lens.currentRenderDepth];
  if ((depth !== undefined) && (depth < uiContext[Lens.infiniteRecursionCheckWaterlineDepth])) {
    return false;
  }
  const newFocus = component.getFocus();
  const newKey = component.getKey();
  // eslint-disable-next-line
  while ((uiContext = Object.getPrototypeOf(uiContext))) {
    if (!uiContext.reactComponent || (uiContext.reactComponent.getKey() !== newKey)
        || (uiContext.reactComponent.constructor !== component.constructor)) {
      continue;
    }
    if (uiContext.focus !== newFocus) {
      continue;
    }
    if (_comparePropsOrState(uiContext.reactComponent.props, component.props, "onelevelshallow",
        component.constructor.propsCompareModesOnComponentUpdate, "props")) {
      continue;
    }
    console.log("Infinite render recursion match found in component", component,
            component.state.uiContext,
        "\n\tancestor props:", uiContext.reactComponent.props,
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
        "\n\tidentical ancestor UI context:", uiContext,
        "\n\tidentical ancestor focus:", uiContext.focus.debugId(), uiContext.focus,
        "\n\tidentical ancestor props:", uiContext.reactComponent.props,
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
