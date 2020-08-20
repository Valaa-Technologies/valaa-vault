// @flow
import React from "react";
import isEqual from "lodash.isequal";

import { SourceInfoTag } from "~/raem/VALK/StackTrace";
import { HostRef } from "~/raem/VALK/hostReference";

import Vrapper from "~/engine/Vrapper";

import Lens from "~/inspire/valosheath/valos/Lens";

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

export function _hasRenderDepthFailures (component: UIComponent) {
  let uiContext = component.state.uiContext;
  if (!uiContext || !uiContext.focus) return false;
  const depth = uiContext[Lens.currentRenderDepth];
  if ((depth !== undefined) && (depth < uiContext[Lens.infiniteRecursionCheckWaterlineDepth])) {
    return false;
  }
  let error;
  if (depth >= uiContext[Lens.maximumRenderDepth]) {
    error = new Error(
        `$Lens.currentRenderDepth (${depth}) exceeds $Lens.maximumRenderDepth (${
            uiContext[Lens.maximumRenderDepth]}).`);
  } else {
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
      error = new Error("Infinite component render recursion detected");
      break;
    }
  }
  if (!error) return false;
  const logLines = [
    "\n\tcomponent:", component,
    "\n\tcomponent focus:", component.getFocus(),
    "\n\tcomponent key:", component.getKey(),
    "\n\tcomponent props:", component.props,
    "\n\tcomponent uiContext snapshot:", Object.assign(
        Object.create(Object.getPrototypeOf(component.state.uiContext)),
        component.state.uiContext),
    ...((uiContext === component.state.uiContext) ? [] : [
      "\n\trecurring ancestor:", uiContext.reactComponent,
      "\n\trecurring ancestor focus:", uiContext.reactComponent.getKey(),
      "\n\trecurring ancestor key:", uiContext.reactComponent.getKey(),
      "\n\trecurring ancestor props:", uiContext.reactComponent.props,
      "\n\trecurring ancestor uiContext:", uiContext,
    ]),
  ];
  console.log("Maximum render depth exceeded in component", ...logLines);
  component.enableError(wrapError(error,
      `Exception caught in ${component.debugId()})\n ._hasRenderDepthFailures(), with:`,
      ...logLines,
  ), "UIComponent._hasRenderDepthFailures");
  return true;
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
    return "length";
  }
  for (const key of leftKeys) {
    if (!rightObject.hasOwnProperty(key)) {
      /*
      if (verbosity) {
        console.info(type, "right side missing key:", key);
      }
      */
      return key;
    }
    const entryMode = entryCompares[key] || defaultEntryCompare;
    if (entryMode === "ignore") continue;
    const left = leftObject[key];
    const right = rightObject[key];
    const _isSubSimplyEqual = _isSimplyEqual(left, right);
    if (_isSubSimplyEqual === true) continue;
    if (_isSubSimplyEqual === false) return key;
    if (entryMode === "shallow") {
      /*
      if (verbosity) {
        console.info(type, "shallow objects differ:", key, left, right);
      }
      */
      return key;
    }
    if (entryMode === "onelevelshallow") {
      const subMismatch =
          _comparePropsOrState(left, right, "shallow", entryCompares, undefined, verbosity);
      if (!subMismatch) continue;

      /*
      if (verbosity) {
        console.info(type, "onelevelshallow objects differ:", key, left, right);
      }
      */
      return `${key}.${subMismatch}`;
    }
    if (!isEqual(left, right)) {
      /*
      if (verbosity) {
        console.info(type, "deep objects differ:", key, left, right);
      }
      */
      return key;
    }
  }
  return false;
}

function _isSimplyEqual (left, right) {
  if (left === right) return true;
  if (typeof left !== typeof right) return false;
  if (typeof left === "function") return (left.name === right.name);
  if ((typeof left !== "object") || (left === null) || (right === null)) return false;
  const leftRef = left[HostRef];
  if (leftRef) return leftRef === right[HostRef];
  const isLeftReactElement = React.isValidElement(left);
  if (isLeftReactElement !== React.isValidElement(right)) return false;
  if (isLeftReactElement) {
    if (left[SourceInfoTag] || right[SourceInfoTag]) return false;
  }
  return undefined;
}
