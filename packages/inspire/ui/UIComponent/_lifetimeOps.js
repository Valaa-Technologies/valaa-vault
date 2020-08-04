// @flow

import { dumpObject } from "~/engine/VALEK";
import Vrapper from "~/engine/Vrapper";

import { thenChainEagerly, wrapError } from "~/tools";

import Lens from "~/inspire/valosheath/valos/Lens";

import type UIComponent from "./UIComponent";

import { getScopeValue, setScopeValue } from "./scopeValue";

import { _comparePropsOrState } from "./_propsOps";
import { _initiateSubscriptions } from "./_subscriberOps";

// const _timings = {};

/*
function _addTiming (component, name, start, options) {
  const duration = performance.now() - start;
  const timing = _timings[name] || (_timings[name] = { total: 0, count: 0 });
  timing.total += duration;
  ++timing.count;
  console.log(component.constructor.name, component.getKey(), name,
      "duration:", duration, "count:", timing.count, "total:", timing.total,
      ...(options ? ["\n\toptions:", options] : []),
  );
}
*/

export function _componentConstructed (component: UIComponent, props: Object, context: Object) {
  // const start = performance.now();
  component._activeParentFocus = _getActiveParentFocus(props, context);
  _tryUpdateUIContext(component, props, props.context);
  _updateFocus(component, props, context);
  // _addTiming(component, "componentConstructed.updateFocus", start, { props, context });
}

export function _componentWillReceiveProps (component: UIComponent, nextProps: Object,
    nextContext: Object, forceReattachListeners: ?boolean) {
  // const start = performance.now();
  const nextActiveParentFocus = _getActiveParentFocus(nextProps, nextContext);
  const oldProps = component.props;
  const shouldUpdateFocus = (forceReattachListeners === true)
      || (component._activeParentFocus !== nextActiveParentFocus)
      || (nextProps.focus !== oldProps.focus);
  // _addTiming(component, "componentWillReceiveProps.check", start,
  //    { shouldUpdateUIContext, shouldUpdateFocus });
  // const startUpdate = performance.now();
  _tryUpdateUIContext(component, nextProps, !shouldUpdateFocus && oldProps.context);
  if (shouldUpdateFocus) {
    component._activeParentFocus = nextActiveParentFocus;
    component._errorObject = null;
    _updateFocus(component, nextProps, nextContext, oldProps, forceReattachListeners);
  }
  // _addTiming(component, "componentWillReceiveProps.updateFocus", startUpdate);
}

// If there is no local props focus, we track parent focus changes for props updates.
function _getActiveParentFocus (props: Object, context: Object) {
  if (props.hasOwnProperty("focus") || !context.parentUIContext) return undefined;
  return getScopeValue(context.parentUIContext, "focus");
}

function _tryUpdateUIContext (component, nextProps, oldPropsContext) {
  const arrayIndex = nextProps.arrayIndex;
  const uiContext = component.state.uiContext;
  if (arrayIndex !== undefined) {
    setScopeValue(uiContext, Lens.arrayIndex, arrayIndex);
    setScopeValue(uiContext, Lens.elementIndex,
        nextProps.elementIndex !== undefined ? nextProps.elementIndex : arrayIndex);
  }
  const propsContext = nextProps.context;
  if (!propsContext
      || (oldPropsContext && !_comparePropsOrState(propsContext, oldPropsContext, "shallow"))) {
    return;
  }
  for (const name of Object.getOwnPropertyNames(propsContext)) {
    setScopeValue(uiContext, name, propsContext[name]);
  }
  for (const symbol of Object.getOwnPropertySymbols(propsContext)) {
    setScopeValue(uiContext, symbol, propsContext[symbol]);
  }
}

function _updateFocus (component: UIComponent, newProps: Object, newContext: Object,
    oldProps: Object, forceReattachListeners: ?boolean) {
  /*
  console.log(component.debugId(), "._updateFocus",
      "\n\tnew context.parentUIContext:", newContext.parentUIContext,
      "\n\tnew props.focus:", newProps.focus);
  // */
  const parentUIContext = newContext.parentUIContext;
  if (!parentUIContext) return;
  let newFocus = newProps.hasOwnProperty("focus")
      ? newProps.focus
      : getScopeValue(parentUIContext, "focus");
  if (newProps.kuery !== undefined) throw new Error("props.kuery no longer supported");
  const uiContext = component.state.uiContext;
  const oldFocus = getScopeValue(uiContext, "focus");
  thenChainEagerly(newFocus, [
    function _updateContextFocus (resolvedNewFocus) {
      // console.log(component.debugId(), "_updateContextFocus", resolvedNewFocus);
      newFocus = resolvedNewFocus;
      setScopeValue(uiContext, "focus", newFocus);
      setScopeValue(uiContext, "head", newFocus);
      return (newFocus instanceof Vrapper)
          && newFocus.isResource()
          && newFocus.activate();
    },
    function _validateResourceFocusIsActive (isResource) {
      // console.log(component.debugId(), "_validateResourceFocusIsActive", isResource);
      if (!isResource || newFocus.isActive()) return;
      let error;
      if (newFocus.isInactive() || newFocus.isActivating()) {
        error = new Error(`Resource ${newFocus.debugId()} did not activate properly; ${
          ""} expected focus status to be 'Active', got '${newFocus.getPhase()}' instead`);
        error.slotName = newFocus.isInactive() ? "inactiveLens" : "activatingLens";
      } else if (newFocus.isImmaterial()) {
        error = new Error(`Resource ${newFocus.debugId()} has been destroyed`);
        error.slotName = "destroyedLens";
      } else if (newFocus.isUnavailable()) {
        error = new Error(`Resource ${newFocus.debugId()} is unavailable`);
        error.slotName = "unavailableLens";
      } else {
        error = new Error(`Resource ${newFocus.debugId()} has unrecognized phase '${
          newFocus.getPhase()}'`);
      }
      throw error;
    },
    function _reinitiateFocusSubscriptions () {
      if (component._areSubscriptionsBound) {
        if ((!forceReattachListeners && (oldFocus === newFocus))
        // If some later update has updated focus prevent subscriber
        // (re)attach and let the later update handle it instead.
            || (getScopeValue(uiContext, "focus") !== newFocus)) {
          return false;
        }
        component.unbindSubscriptions();
      }
      if (newFocus === undefined) return true;
      return _initiateSubscriptions(component, newFocus, newProps);
    },
    function _update (shouldUpdate) {
      // console.log(component.debugId(), "_update", shouldUpdate);
      if ((shouldUpdate !== false) && oldProps) {
        component.forceUpdate();
      }
    },
  ], function errorOnCreateContextAndSetFocus (error) {
    component.enableError(
        wrapError(error, new Error(`_updateFocus()`),
            "\n\tnew focus:", ...dumpObject(newFocus),
            "\n\tnew props:", ...dumpObject(newProps),
            "\n\tcomponent:", ...dumpObject(component)),
        "UIComponent._updateFocus");
  });
}

export function _shouldComponentUpdate (component: UIComponent, nextProps: Object,
    nextState: Object, nextContext: Object): boolean { // eslint-disable-line
  // const start = performance.now();
  let mismatch = _comparePropsOrState(component.props, nextProps, "deep",
      component.constructor.propsCompareModesOnComponentUpdate, "props");
  if (mismatch) return `props.${mismatch}`;
  mismatch = _comparePropsOrState(component.state, nextState, "deep",
      component.constructor.stateCompareModesOnComponentUpdate, "state");
  if (mismatch) return `state.${mismatch}`;
  // _addTiming(component, "shouldComponentUpdate.check", start,
  //    { ret, component, nextProps, nextState, nextContext });
  return false;
}

export function _componentWillUnmount (component: UIComponent) {
  // const start = performance.now();
  component.unbindSubscriptions();
  if (component.context.releaseVssSheets) component.context.releaseVssSheets(component);
  // _addTiming(component, "componentWillUnmount", start);
}
