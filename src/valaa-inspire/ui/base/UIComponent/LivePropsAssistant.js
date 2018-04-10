// @flow
import React from "react";
import PropTypes from "prop-types";
import { OrderedMap } from "immutable";

import { asyncConnectToPartitionsIfMissingAndRetry, tryConnectToMissingPartitionsAndThen }
    from "~/valaa-core/tools/denormalized/partitions";
import { Kuery } from "~/valaa-core/VALK";

import { FieldUpdate } from "~/valaa-engine/Vrapper";
import getImplicitCallable from "~/valaa-engine/interpreter/getImplicitCallable";

import ValaaScope from "~/valaa-inspire/ui/vidget/ValaaScope";
import { isThunk } from "~/valaa-inspire/ui/helper/thunk";
import UIComponent, { ReactPropTypesKuery } from "~/valaa-inspire/ui/base/UIComponent";

import { isPromise, outputError, wrapError } from "~/valaa-tools";

import { uiComponentProps, isUIComponentElement } from "./index";

/* eslint-disable react/prop-types */

/**
 * An UIComponent which wraps another element of given props.elementType and manages its live props.
 *
 * Live props are passed into LivePropsAssistant through props.liveProps (a map of string kuery key
 * to live kuery). LivePropsAssistant keeps track of these kueries (valked from
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
 * Note: as LivePropsAssistant is an UIComponent it can be passed the normal UIComponent props like
 * props.uiContext or props.parentUIContext and props.kuery: however the resulting local
 * uiContext.focus will not affect the live props and is only used for the children (if any).
 *
 * @export
 * @class LivePropsAssistant
 * @extends {UIComponent}
 */
export default class LivePropsAssistant extends UIComponent {
  static propTypes = {
    ...UIComponent.propTypes,
    elementType: PropTypes.any.isRequired,
    elementProps: PropTypes.object.isRequired,
    liveProps: PropTypes.object, // Must be Map
    refKuery: ReactPropTypesKuery,
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

  _detachSubscribers () {
    super._detachSubscribers();
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

  renderUIComponent () {
    if (this.props.liveProps) {
      let pendingProps;
      const livePropValues = this.state.livePropValues || OrderedMap();
      for (const kueryId of Object.keys(this.props.liveProps)) {
        if (!livePropValues.has(kueryId)) {
          (pendingProps || (pendingProps = [])).push(kueryId);
        }
      }
      if (pendingProps) {
        this.trySetUIContextValue(this.getValaa().pendingPropNames, pendingProps.join(", "));
        try {
          return this.renderLensRole("pendingPropsLens");
        } finally {
          this.tryClearUIContextValue(this.getValaa().pendingPropNames);
        }
      }
    }

    const newProps = { ...this.props.elementProps };
    let promises;
    for (const name of Object.keys(this.props.elementProps)) {
      const prop = this.props.elementProps[name];
      if ((typeof prop === "function") && prop.kueryId) {
        newProps[name] = prop(this.state.livePropValues);
        if ((name.slice(0, 2) === "on") && (typeof newProps[name] !== "function")) {
          newProps[name] = getImplicitCallable(newProps[name], `props.${name}`,
              { immediate: undefined /* allows promise return values */ });
        }
      }
      if (isPromise(newProps[name])) (promises || (promises = {}))[name] = newProps[name];
    }
    if (promises) {
      Promise.all(Object.values(promises)).then(() => { this.forceUpdate(); });
      this.trySetUIContextValue(this.getValaa().delayedPropNames, Object.keys(promises).join(", "));
      try {
        return this.renderLensRole("delayedPropsLens");
      } finally {
        this.tryClearUIContextValue(this.getValaa().delayedPropNames);
      }
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
    let children = this.arrayFromValue(this.props.children);
    const valaaScope = newProps.valaaScope;
    if (valaaScope) delete newProps.valaaScope;
    else if (!this.props.elementType.isUIComponent) {
      // if no valaaScope is requested and the element is not an UIElement we need to post-process
      // children now and deal with a possible resulting promise.
      children = this.renderLensSequence(children);
      if (isPromise(children)) {
        children.then(() => { this.forceUpdate(); });
        return this.renderLensRole("delayedChildrenLens");
      }
    }
    const element = React.createElement(this.props.elementType, newProps, ...children);
    return valaaScope
        ? React.createElement(ValaaScope, { ...valaaScope, overrideLens: [element] })
        : element;
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

export function wrapInLivePropsAssistant (component: UIComponent, element: Object, name?: string) {
  const ret = tryWrapInLivePropsAssistant(component, element, name);
  return typeof ret !== "undefined" ? ret : element;
}

export function tryWrapInLivePropsAssistant (component: UIComponent, element: Object,
    name?: string) {
  const { type, props, ref } = element;
  if (type === LivePropsAssistant) return undefined;
  const liveProps = { currentIndex: 0 };
  const livePropLookup = new Map(); // deduplicate identical kueries
  let liveElementProps;
  function _obtainLiveElementProps () {
    if (!liveElementProps) liveElementProps = { ...props };
    return liveElementProps;
  }
  try {
    for (const propName of Object.keys(props)) {
      if (propName === "liveProps" || propName === "children") continue;
      const propType = type.propTypes && type.propTypes[propName];
      if (propType && propType.noPropsInspirePostProcess) continue;
      const newProp = _postProcessProp(
          props[propName], livePropLookup, liveProps, propName, component);
      if (typeof newProp !== "undefined") {
        _obtainLiveElementProps()[propName] = newProp;
      }
    }
    if (ref && (ref instanceof Kuery)) {
      // Rewrite ref kuery as refKuery so that LivePropsAssistant can evaluate it.
      _obtainLiveElementProps().refKuery =
          _postProcessProp(ref, livePropLookup, liveProps, "ref", component);
    }
    let assistantPropsOptions;
    if (isUIComponentElement(element)) {
      if (!liveElementProps) {
        // If UIComponent has no live props and already has a uiContext/parentUIContext no
        // processing is required now: The UIComponent does its own post-processing.
        if (props.uiContext || props.parentUIContext) return undefined;
        // Otherwise provide the current component context as the parentUIContext for the component.
        const newProps = { ...props, parentUIContext: component.getUIContext() };
        delete newProps.children;
        /*
        console.log("tryWrapInLivePropsAssistant UIComponent", type.name, newProps,
            "\n\toriginal props:", props,
            "\n\toriginal element:", element,
            "\n\tparent component:", component);
        */
        return React.createElement(type, newProps, ...component.arrayFromValue(props.children));
      }
      // UIComponent with live props does its own path kuery management, Wrapper needs to only
      // manage the props.
      assistantPropsOptions = { name, parentUIContext: component.getUIContext() };
    } else if (props.hasOwnProperty("kuery")) {
      // Non-UIComponent elements which have specified a kuery need to be managed even if there are
      // no live props.
      console.error("DEPRECATED: props.kuery",
          "\n\tprefer: props.valaaScope.focus",
          "\n\talternatively for Valaa components: props.focus",
          "\n\tin component:", component.debugId(), component);
      delete _obtainLiveElementProps().kuery;
      assistantPropsOptions = {
        name, parentUIContext: component.getUIContext(), kuery: props.kuery
      };
    } else if (!liveElementProps) {
      // non-UIComponent element with no live props: post-process its children directly here.
      const processedChildren = component.tryRenderLensSequence(props.children);
      return processedChildren && React.createElement(type, props, ...processedChildren);
    } else {
      // non-UIComponent element with live props. Prepare live wrapper kuery options.
      // Because wrapper doesn't touch its uiContext we can forward our own to it.
      assistantPropsOptions = { name, parentUIContext: component.getUIContext() };
    }
    let assistantProps: any = { elementType: type, elementProps: liveElementProps };
    if (liveProps.currentIndex) {
      delete liveProps.currentIndex;
      assistantProps.liveProps = liveProps;
    }
    assistantProps = uiComponentProps(assistantPropsOptions, assistantProps);
    // console.log("tryWrapInLivePropsAssistant LiveWrapper for", type.name, wrapperProps);
    return React.createElement(LivePropsAssistant, assistantProps, props.children);
  } catch (error) {
    throw wrapError(error, `During ${component.debugId({ suppressKueries: true })
            }\n .tryWrapInLivePropsAssistant(`,
            typeof type === "function" ? type.name : type, `), with:`,
        "\n\telement.props:", props,
        "\n\telement.props.children:", props && props.children,
        "\n\tpropsKueries:", liveProps,
        "\n\tlivePropLookup:", livePropLookup,
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
function _postProcessProp (prop: any, livePropLookup: Object, liveProps: Object,
    name: string, component: UIComponent) {
  if ((typeof prop !== "object") || (prop === null)) return undefined;
  if (prop instanceof Kuery) {
    let ret = livePropLookup.get(prop.kueryId());
    if (typeof ret === "undefined") {
      const liveKueryName = `props#${liveProps.currentIndex++}.${name}`;
      liveProps[liveKueryName] = prop;
      ret = function fetchLiveProp (livePropValues: OrderedMap) {
        try {
          return livePropValues.get(liveKueryName);
        } catch (error) {
          throw wrapError(error, `During fetchLiveProp(${liveKueryName}), with:`,
              "\n\tkueryId:", ret.kueryId,
              "\n\tname:", name,
              "\n\tcomponent:", component.debugId());
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
    const postProcessedValue =
        _postProcessProp(prop[key], livePropLookup, liveProps, name, component);
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
