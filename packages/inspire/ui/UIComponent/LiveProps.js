// @flow

import React from "react";
import PropTypes from "prop-types";
import { OrderedMap } from "immutable";

import { asyncConnectToPartitionsIfMissingAndRetry, tryConnectToMissingPartitionsAndThen }
    from "~/raem/tools/denormalized/partitions";
import { Kuery } from "~/raem/VALK";

import { FieldUpdate, getImplicitCallable } from "~/engine/Vrapper";

import ValaaScope from "~/inspire/ui/ValaaScope";
import { isThunk } from "~/inspire/ui/thunk";
import UIComponent from "~/inspire/ui/UIComponent";

import { arrayFromAny, isPromise, outputError, wrapError } from "~/tools";

import { _wrapElementInLiveProps } from "./_renderOps";

/* eslint-disable react/prop-types */

/**
 * An UIComponent which wraps another element of given props.elementType and manages its live props.
 *
 * Live props are passed into LiveProps through props.liveProps (a map of string kuery key
 * to live kuery). LiveProps keeps track of these kueries (valked from
 * parentUIContext.focus) and maintains their current values in corresponding map of kuery key to
 * current value.
 *
 * When rendering the element, props.elementProps are pre-processed and props values which are
 * callback functions will be called with the live value map and the return values used as the final
 * prop value that is passed to the element. This roughly mimics following JSX:
 *
 * <props.elementType {...processedProps}>{this.props.children}</props.elementType>
 *
 * The element can be any element, even another UIComponent; however such an UIComponent won't
 * receive any special treatment and will need to receive its props through props.elementProps.
 *
 * Note: as LiveProps is an UIComponent it can be passed the normal UIComponent props like
 * props.uiContext or props.parentUIContext and props.kuery: however the resulting local
 * uiContext.focus will not affect the live props and is only used for the children (if any).
 *
 * @export
 * @class LiveProps
 * @extends {UIComponent}
 */
export default class LiveProps extends UIComponent {
  static propTypes = {
    ...UIComponent.propTypes,
    elementType: PropTypes.any.isRequired,
    elementProps: PropTypes.object.isRequired,
    liveProps: PropTypes.object, // Must be Map
    refKuery: PropTypes.instanceOf(Kuery),
  }
  static noPostProcess = {
    ...UIComponent.noPostProcess,
    liveProps: true,
    refKuery: true,
  }

  constructor (props: any, context: any) {
    super(props, context);
    this.state = {
      ...super.state,
      livePropValues: null,
    };
  }

  attachSubscribers (focus: any, props: Object) {
    super.attachSubscribers(focus, props);
    // Live props are always based on the parent focus.
    // Now uselessly reattaching listeners if the local focus changes.
    let contextThis = this.getUIContextValue("this");
    if (typeof contextThis === "undefined") contextThis = {};
    for (const kueryId of Object.keys(props.liveProps || {})) {
      const kuery = props.liveProps[kueryId];
      this.attachKuerySubscriber(`LivePropsComponent.liveProps['${kueryId}']`,
          contextThis,
          kuery, {
            scope: this.getUIContext(),
            onUpdate: (update: FieldUpdate) => this.setState((prevState) => {
              const value = update.value();
              return {
                livePropValues: (prevState.livePropValues || OrderedMap())
                    .set(kueryId, !isThunk(value)
                        ? value
                        : asyncConnectToPartitionsIfMissingAndRetry(value))
              };
            }),
          });
    }
  }

  detachSubscribers () {
    super.detachSubscribers();
    this.setState({ livePropValues: null });
  }

  shouldComponentUpdate (nextProps: Object, nextState: Object) {
    if (nextState.livePropValues !== this.state.livePropValues) return true;
    if (nextProps !== this.props) return true;
    return false;
  }

  componentWillReceiveProps (nextProps: Object, nextContext: Object) {
    super.componentWillReceiveProps(nextProps, nextContext,
        nextProps.liveProps !== this.props.liveProps);
  }

  renderLoadedFocus (focus: any) {
    if (this.props.liveProps) {
      const unfinishedKueries = [];
      const livePropValues = this.state.livePropValues || OrderedMap();
      for (const kueryId of Object.keys(this.props.liveProps)) {
        if (!livePropValues.has(kueryId)) {
          unfinishedKueries.push({ name: kueryId, kuery: this.props.liveProps[kueryId] });
        }
      }
      if (unfinishedKueries.length) {
        return this.renderLensRole("kueryingPropsLens", unfinishedKueries);
      }
    }

    const newProps = { ...this.props.elementProps };
    let pendingProps;
    for (const name of Object.keys(this.props.elementProps)) {
      const prop = this.props.elementProps[name];
      if ((typeof prop === "function") && prop.kueryId) {
        newProps[name] = prop(this.state.livePropValues);
        if ((name.slice(0, 2) === "on") && (typeof newProps[name] !== "function")) {
          newProps[name] = getImplicitCallable(newProps[name], `props.${name}`,
              { immediate: undefined /* allows promise return values */ });
        }
      }
      if (isPromise(newProps[name])) (pendingProps || (pendingProps = {}))[name] = newProps[name];
    }
    if (pendingProps) {
      Promise.all(Object.values(pendingProps)).then(() => { this.forceUpdate(); });
      return this.renderLensRole("pendingPropsLens", pendingProps);
    }

    if (newProps.refKuery) {
      newProps.ref = newProps.refKuery;
      delete newProps.refKuery;
    }
    for (const propName of Object.getOwnPropertyNames(newProps)) {
      if (typeof newProps[propName] === "function") {
        newProps[propName] = this._wrapInValaaExceptionProcessor(newProps[propName], propName);
      }
    }
    let children = arrayFromAny(this.props.children);
    const valaaScope = newProps.valaaScope;
    if (valaaScope) delete newProps.valaaScope;
    else if (!this.props.elementType.isUIComponent) {
      // if no valaaScope is requested and the element is not an UIElement we need to post-process
      // children now and deal with a possible resulting promise.
      children = this.renderLensSequence(children, focus);
      if (isPromise(children)) {
        children.then(() => { this.forceUpdate(); });
        return this.renderLensRole("pendingChildrenLens", focus);
      }
    }
    /* Only enable this section for debugging React key warnings; it will break react elsewhere
    let elementType = this.props.elementType;
    if (elementType === ValaaScope) {
      elementType = class DebugValaaScope extends ValaaScope {};
      Object.defineProperty(elementType, "name", {
        value: `ValaaScope_${newProps.className || ""}${this.getUIContextValue("key")}`,
      });
    }
    /*/
    const elementType = this.props.elementType;
    // eslint-disable-next-line
    //*/
    if (!newProps.key) {
      newProps.key = this.getUIContextValue("key");
    }
    const element = React.createElement(elementType, newProps, ...children);
    return _wrapElementInLiveProps(
        this,
        !valaaScope
            ? element
            : React.createElement(ValaaScope,
                { ...valaaScope, key: newProps.key, overrideLens: [element] }),
        "focus");
  }

  _wrapInValaaExceptionProcessor (callback: Function, name: string) {
    const component = this;
    const ret = function handleCallbackExceptions (...args: any[]) {
      try {
        return callback.call(this, ...args);
      } catch (error) {
        const connectingMissingPartitions = tryConnectToMissingPartitionsAndThen(error,
            () => handleCallbackExceptions(...args));
        if (connectingMissingPartitions) return connectingMissingPartitions;
        const finalError = wrapError(error,
            `Exception caught in ${component.debugId()})\n .props.${name}, with:`,
            "\n\targs:", args,
            "\n\tcontext:", component.state.uiContext,
            "\n\tstate:", component.state,
            "\n\tprops:", component.props,
        );

        outputError(finalError);
        component.enableError(finalError);
      }
      return undefined;
    };
    Object.defineProperty(ret, "name", { value: `handleExceptionsOf_${name}` });
    return ret;
  }
}

