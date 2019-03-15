// @flow

import { dumpKuery, dumpObject } from "~/engine/VALEK";
import Vrapper, { FieldUpdate } from "~/engine/Vrapper";

import { invariantify, outputError, thenChainEagerly, wrapError } from "~/tools";

import type UIComponent from "./UIComponent";
import { getScopeValue, setScopeValue } from "./scopeValue";

import { _comparePropsOrState } from "./_propsOps";
import { _initiateSubscriptions, _finalizeDetachSubscribersExcept } from "./_subscriberOps";

export function _componentWillMount (component: UIComponent) {
  component._activeParentFocus = _getActiveParentFocus(component, component.props);
  _updateFocus(component, component.props);
}

export function _componentWillReceiveProps (component: UIComponent, nextProps: Object,
    nextContext: Object, forceReattachListeners: ?boolean) {
  const nextActiveParentFocus = _getActiveParentFocus(component, nextProps);
  if ((forceReattachListeners === true)
      || (nextProps.uiContext !== component.props.uiContext)
      || (nextProps.parentUIContext !== component.props.parentUIContext)
      || (component._activeParentFocus !== nextActiveParentFocus)
      || (nextProps.focus !== component.props.focus)
      || (nextProps.head !== component.props.head)
      || (nextProps.kuery !== component.props.kuery)
      || _comparePropsOrState(nextProps.context, component.props.context, "shallow")
      || _comparePropsOrState(nextProps.locals, component.props.locals, "shallow")) {
    component._activeParentFocus = nextActiveParentFocus;
    _updateFocus(component, nextProps);
  }
}

// If there is no local props focus, we track parent focus changes for props updates.
function _getActiveParentFocus (component: UIComponent, props: Object) {
  if (props.hasOwnProperty("focus") /* || props.hasOwnProperty("head") */
      || !props.parentUIContext) {
    return undefined;
  }
  return getScopeValue(props.parentUIContext, "focus");
  /*
  return props.parentUIContext.hasOwnProperty("focus")
      ? getScopeValue(props.parentUIContext, "focus")
      : getScopeValue(props.parentUIContext, "head");
  */
}

function _updateFocus (component: UIComponent, newProps: Object) {
  try {
    /*
    console.warn(component.debugId(), "._updateFocus",
        "\n\tnew props.uiContext:", newProps.uiContext,
        "\n\tnew props.parentUIContext:", newProps.parentUIContext,
        "\n\tnew props.head:", newProps.head,
        "\n\tnew props.focus:", newProps.focus,
        "\n\tnew props.kuery:", ...dumpKuery(newProps.kuery));
    // */
    component.detachSubscribers();
    component._errorObject = null;

    if (newProps.uiContext && newProps.parentUIContext) {
      invariantify(!(newProps.uiContext && newProps.parentUIContext),
      `only either ${component.constructor.name
          }.props.uiContext or ...parentUIContext can be defined at the same time`);
    }

    const scope = newProps.uiContext || newProps.parentUIContext;
    if (!scope) return;
    const focus = newProps.hasOwnProperty("focus")
        ? newProps.focus : getScopeValue(scope, "focus");
        /*
        : newProps.hasOwnProperty("head") ? newProps.head
        : (typeof getScopeValue(uiContext, "focus") !== "undefined")
            ? getScopeValue(uiContext, "focus")
        : getScopeValue(uiContext, "head");
        */
    if (focus === undefined) return;
    if (newProps.kuery === undefined) {
      _createContextAndSetFocus(component, focus, newProps);
      return;
    }
    if (!newProps.parentUIContext) {
      invariantify(newProps.parentUIContext, `if ${component.constructor.name
      }.props.kuery is specified then ...parentUIContext must also be specified`);
    }
    if (component.state.uiContext) {
      component.setUIContextValue("focus", undefined);
      component.setUIContextValue("head", undefined);
    }
    component.subscribeToKuery("UIComponent.focus", focus, newProps.kuery, {
      scope,
      onUpdate: (update: FieldUpdate) => {
        _finalizeDetachSubscribersExcept(component, "UIComponent.focus");
        _createContextAndSetFocus(component, update.value(), newProps);
      },
    });
  } catch (error) {
    throw wrapError(error, `During ${component.debugId()}\n ._updateFocus:`,
        "\n\tnew props:", newProps,
        ...(newProps.uiContext ? ["\n\tnew props.uiContext:", newProps.uiContext] : []),
        ...(newProps.parentUIContext
            ? ["\n\tnew props.parentUIContext:", newProps.parentUIContext] : []),
        ...(newProps.kuery ? ["\n\tnew props.kuery:", ...dumpKuery(newProps.kuery)] : []),
        "\n\tcurrent props:", component.props,
        "\n\tstate:", component.state,
    );
  }
}

const depthTag = Symbol("ContextDepth");

function _createContextAndSetFocus (component: UIComponent, newFocus: any, newProps: Object) {
  const uiContext = newProps.uiContext
      || component.state.uiContext
      || Object.create(component.props.parentUIContext);
  uiContext[depthTag] = (component.props.parentUIContext[depthTag] || 0) + 1;
  setScopeValue(uiContext, "focus", newFocus);
  setScopeValue(uiContext, "head", newFocus);
  /*
  if (newProps.locals) {
    console.error("DEPRECATED: ValaaScope.locals\n\tprefer: ValaaScope.context");
    for (const key of Object.keys(newProps.locals)) {
      setScopeValue(uiContext, key, newProps.locals[key]);
    }
  }
  */
  if (newProps.context) {
    for (const name of Object.getOwnPropertyNames(newProps.context)) {
      setScopeValue(uiContext, name, newProps.context[name]);
    }
    for (const symbol of Object.getOwnPropertySymbols(newProps.context)) {
      setScopeValue(uiContext, symbol, newProps.context[symbol]);
    }
  }
  uiContext.reactComponent = component;
  if (component.state.uiContext !== uiContext) {
    component.setState({ uiContext }, _attachSubscribersWhenDone);
  } else {
    _attachSubscribersWhenDone();
    component.forceUpdate();
  }
  function _attachSubscribersWhenDone () {
    if (newFocus === undefined) return;
    const isResource = (newFocus instanceof Vrapper) && newFocus.isResource();
    thenChainEagerly(null, [
      () => isResource && newFocus.activate(),
      () => {
        if (!isResource) return component;
        if (newFocus.isActive()) {
          // If some later update has updated focus prevent subscriber
          // attach and let the later update handle it instead.
          if (newFocus !== getScopeValue(uiContext, "focus")) return undefined;
          return component;
        }
        let error;
        if (newFocus.isInactive() || newFocus.isActivating()) {
          error = new Error(`Resource ${newFocus.debugId()} did not activate properly; ${
            ""} expected focus status to be 'Active', got '${newFocus.getPhase()}' instead`);
          error.lensRole = newFocus.isInactive() ? "inactiveLens" : "activatingLens";
        } else if (newFocus.isDestroyed()) {
          error = new Error(`Resource ${newFocus.debugId()} has been destroyed`);
          error.lensRole = "destroyedLens";
        } else if (newFocus.isUnavailable()) {
          error = new Error(`Resource ${newFocus.debugId()} is unavailable`);
          error.lensRole = "unavailableLens";
        } else {
          error = new Error(`Resource ${newFocus.debugId()} has unrecognized phase '${
            newFocus.getPhase()}'`);
        }
        throw error;
      },
      component_ => component_ && _initiateSubscriptions(component, newFocus, newProps),
    ], function errorOnCreateContextAndSetFocus (error) {
      outputError(wrapError(error, new Error(`createContextAndSetFocus()`),
          "\n\tnew focus:", ...dumpObject(newFocus),
          "\n\tnew props:", ...dumpObject(newProps),
          "\n\tnew uiContext:", ...dumpObject(uiContext),
          "\n\tcomponent:", ...dumpObject(component)),
          "Exception caught during UIComponent._createContextAndSetFocus");
    });
  }
}

export function _shouldComponentUpdate (component: UIComponent, nextProps: Object,
    nextState: Object, nextContext: Object): boolean { // eslint-disable-line
  const ret = _comparePropsOrState(component.props, nextProps, "deep",
          component.constructor.propsCompareModesOnComponentUpdate, "props")
      || _comparePropsOrState(component.state, nextState, "deep",
          component.constructor.stateCompareModesOnComponentUpdate, "state");
  return ret;
}

export function _componentWillUnmount (component: UIComponent) {
  component._isMounted = false;
  component.detachSubscribers();
  if (component.context.releaseVssSheets) component.context.releaseVssSheets(component);
}
