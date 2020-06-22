// @flow

import { dumpKuery, dumpObject } from "~/engine/VALEK";
import Vrapper, { LiveUpdate } from "~/engine/Vrapper";

import { invariantify, thenChainEagerly, wrapError } from "~/tools";

import type UIComponent from "./UIComponent";
import { getScopeValue, setScopeValue } from "./scopeValue";

import { _comparePropsOrState } from "./_propsOps";
import { _initiateSubscriptions, _finalizeUnbindSubscribersExcept } from "./_subscriberOps";

// const _timings = {};

// function _addTiming (/* component, name, start, ...rest */) {
  /*
  return;
  const duration = performance.now() - start;
  const timing = _timings[name] || (_timings[name] = { total: 0, count: 0 });
  timing.total += duration;
  ++timing.count;
  console.log(component.constructor.name, component.getKey(), name, ...rest,
      "duration:", duration, "count:", timing.count, "total:", timing.total);
  */
// }

export function _componentConstructed (component: UIComponent, props: Object) {
  // const start = performance.now();
  component._activeParentFocus = _getActiveParentFocus(props);
  _updateFocus(component, props);
  // _addTiming(component, "componentWillMount.updateFocus", start);
}

export function _componentWillReceiveProps (component: UIComponent, nextProps: Object,
    nextContext: Object, forceReattachListeners: ?boolean) {
  // const start = performance.now();
  const nextActiveParentFocus = _getActiveParentFocus(nextProps);
  const oldProps = component.props;
  const shouldUpdateFocus = (forceReattachListeners === true)
      || (nextProps.uiContext !== oldProps.uiContext)
      || (nextProps.parentUIContext !== oldProps.parentUIContext)
      || (component._activeParentFocus !== nextActiveParentFocus)
      || (nextProps.focus !== oldProps.focus)
      || (nextProps.head !== oldProps.head)
      || (nextProps.kuery !== oldProps.kuery)
      || _comparePropsOrState(nextProps.context, oldProps.context, "shallow")
      || _comparePropsOrState(nextProps.locals, oldProps.locals, "shallow");
  // _addTiming(component, "componentWillReceiveProps.check", start, shouldUpdateFocus);
  if (shouldUpdateFocus) {
    component._activeParentFocus = nextActiveParentFocus;
    // const startUpdate = performance.now();
    component.unbindSubscriptions();
    component._errorObject = null;
    _updateFocus(component, nextProps, oldProps);
    // _addTiming(component, "componentWillReceiveProps.updateFocus", startUpdate);
  }
}

// If there is no local props focus, we track parent focus changes for props updates.
function _getActiveParentFocus (props: Object) {
  if (props.hasOwnProperty("focus") || props.hasOwnProperty("head") || !props.parentUIContext) {
    return undefined;
  }
  return props.parentUIContext.hasOwnProperty("focus")
      ? getScopeValue(props.parentUIContext, "focus")
      : getScopeValue(props.parentUIContext, "head");
}

function _updateFocus (component: UIComponent, newProps: Object, oldProps: Object) {
  try {
    /*
    console.warn(component.debugId(), "._updateFocus",
        "\n\tnew props.uiContext:", newProps.uiContext,
        "\n\tnew props.parentUIContext:", newProps.parentUIContext,
        "\n\tnew props.head:", newProps.head,
        "\n\tnew props.focus:", newProps.focus,
        "\n\tnew props.kuery:", ...dumpKuery(newProps.kuery));
    // */
    const newUIContext = newProps.uiContext;

    if (newUIContext && newProps.parentUIContext) {
      invariantify(!(newUIContext && newProps.parentUIContext),
      `only either ${component.constructor.name
          }.props.uiContext or ...parentUIContext can be defined at the same time`);
    }

    const scope = newUIContext || newProps.parentUIContext;
    if (!scope) return;
    const focus = newProps.hasOwnProperty("focus")
            ? newProps.focus
        : newProps.hasOwnProperty("head")
            ? newProps.head
        : (getScopeValue(scope, "focus") !== undefined)
            ? getScopeValue(scope, "focus")
            : getScopeValue(scope, "head");
    if (focus === undefined) return;
    if (newProps.kuery === undefined) {
      _createContextAndSetFocus(component, focus, newProps, oldProps);
      return;
    }
    if (!newProps.parentUIContext) {
      invariantify(newProps.parentUIContext, `if ${component.constructor.name
      }.props.kuery is specified then ...parentUIContext must also be specified`);
    }
    if (component.state.uiContext) {
      component.setUIContextValue("focus", undefined);
      // component.setUIContextValue("head", undefined);
    }
    component.bindLiveKuery("UIComponent_focus", focus, newProps.kuery, {
      scope,
      onUpdate: function updateFocusDependents (liveUpdate: LiveUpdate) {
        _finalizeUnbindSubscribersExcept(component, "UIComponent.focus");
        _createContextAndSetFocus(
            component, liveUpdate.value(), newProps, component.props || oldProps);
      },
    });
  } catch (error) {
    throw wrapError(error, `During ${component.debugId()}\n ._updateFocus:`,
        "\n\tnew props:", newProps,
        ...(newProps.uiContext ? ["\n\tnew props.uiContext:", newProps.uiContext] : []),
        ...(newProps.parentUIContext
            ? ["\n\tnew props.parentUIContext:", newProps.parentUIContext] : []),
        ...(newProps.kuery ? ["\n\tnew props.kuery:", ...dumpKuery(newProps.kuery)] : []),
        "\n\told props:", oldProps,
        "\n\tstate:", component.state,
    );
  }
}

function _createContextAndSetFocus (
    component: UIComponent, newFocus: any, newProps: Object, oldProps: Object) {
  const parentUIContext = (oldProps || {}).parentUIContext || newProps.parentUIContext;
  let uiContext = newProps.uiContext || component.state.uiContext;
  if (!uiContext) {
    uiContext = Object.create(parentUIContext);
    uiContext.context = uiContext;
  }

  if (newProps.context) {
    for (const name of Object.getOwnPropertyNames(newProps.context)) {
      setScopeValue(uiContext, name, newProps.context[name]);
    }
    for (const symbol of Object.getOwnPropertySymbols(newProps.context)) {
      setScopeValue(uiContext, symbol, newProps.context[symbol]);
    }
  }

  if (component.state.uiContext === uiContext) {
    _attachSubscribersWhenDone();
    if (oldProps) component.forceUpdate();
  } else {
    uiContext.reactComponent = component;
    const currentDepthSlot = component.getValos().Lens.currentRenderDepth;
    uiContext[currentDepthSlot] = (parentUIContext[currentDepthSlot] || 0) + 1;
    component.setState({ uiContext }, _attachSubscribersWhenDone);
  }
  function _attachSubscribersWhenDone () {
    if (newFocus === undefined) return;
    thenChainEagerly(newFocus, [
      function _updateContextFocus (resolvedNewFocus) {
        setScopeValue(uiContext, "focus", resolvedNewFocus);
        setScopeValue(uiContext, "head", resolvedNewFocus);
        const isResource = (newFocus instanceof Vrapper) && newFocus.isResource();
        return isResource && newFocus.activate();
      },
      function _validateResourceFocusIsActive (isResource) {
        if (!isResource) return true;
        if (newFocus.isActive()) {
          // If some later update has updated focus prevent subscriber
          // attach and let the later update handle it instead.
          if (newFocus !== getScopeValue(uiContext, "focus")) return false;
          return true;
        }
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
      function _initiateFocusSubscriptions (shouldInitiate) {
        if (shouldInitiate) _initiateSubscriptions(component, newFocus, newProps);
      },
    ], function errorOnCreateContextAndSetFocus (error) {
      component.enableError(
          wrapError(error, new Error(`createContextAndSetFocus()`),
              "\n\tnew focus:", ...dumpObject(newFocus),
              "\n\tnew props:", ...dumpObject(newProps),
              "\n\tnew uiContext:", ...dumpObject(uiContext),
              "\n\tcomponent:", ...dumpObject(component)),
          "UIComponent._createContextAndSetFocus");
    });
  }
}

export function _shouldComponentUpdate (component: UIComponent, nextProps: Object,
    nextState: Object, nextContext: Object): boolean { // eslint-disable-line
  // const start = performance.now();
  const ret = _comparePropsOrState(component.props, nextProps, "deep",
          component.constructor.propsCompareModesOnComponentUpdate, "props")
      || _comparePropsOrState(component.state, nextState, "deep",
          component.constructor.stateCompareModesOnComponentUpdate, "state");
  // _addTiming(component, "shouldComponentUpdate.check", start, ret);
  return ret;
}

export function _componentWillUnmount (component: UIComponent) {
  // const start = performance.now();
  component.unbindSubscriptions();
  if (component.context.releaseVssSheets) component.context.releaseVssSheets(component);
  // _addTiming(component, "componentWillUnmount", start);
}
