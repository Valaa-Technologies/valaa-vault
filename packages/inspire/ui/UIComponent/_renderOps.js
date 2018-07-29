// @flow

import React from "react";
import { OrderedMap } from "immutable";

import { tryConnectToMissingPartitionsAndThen } from "~/raem/tools/denormalized/partitions";
import { Kuery, dumpKuery } from "~/raem/VALK";

import Vrapper from "~/engine/Vrapper";

import { arrayFromAny, dumpObject, isPromise, isSymbol, outputError, wrapError } from "~/tools";

import UIComponent, { isUIComponentElement } from "./UIComponent";
import { uiComponentProps } from "./_propsOps";

/* eslint-disable react/prop-types */

// In general the render operations within delegate renders to each other through the component
// and not directly (like component.tryRenderLensRole instead of
// _tryRenderLensRole(component)) to get the try-catch handling.

export function _render (component: UIComponent):
    null | string | React.Element<any> | [] {
  let ret: void | null | string | React.Element<any> | [] | Promise<any>;
  try {
    /*
    console.warn(`${component.debugId()}.render()`, component,
        "\n\tfocus:", component.tryFocus(),
        "\n\tstate:", component.state,
        "\n\tprops:", component.props);
    //*/
    if (component.props.overrideLens) {
      ret = _renderFirstAlternate(component, component.tryFocus(), component.props.overrideLens,
          "override");
    } else if (typeof component.state.uiContext === "undefined") {
      ret = component.tryRenderLensRole("disabledLens", { uiContext: null });
    // eslint-disable-next-line
    } else {
      const focus = component.tryFocus();
      if (typeof focus === "undefined") {
        ret = component.tryRenderLensRole("kueryingFocusLens",
            { kuery: dumpKuery(this.props.kuery || this.props.focus) });
      } else {
        switch (!(focus instanceof Vrapper) ? "" : focus.getPhase()) {
          default: {
            ret = component.renderLoadedFocus(focus);
            break;
          }
          case "Inactive":
            ret = component.tryRenderLensRole("inactiveLens", focus);
            break;
          case "Unavailable":
            ret = component.tryRenderLensRole("unavailableLens", focus);
            break;
          case "Destroyed":
            ret = component.tryRenderLensRole("destroyedLens", focus);
            break;
          case "Activating":
            ret = focus.activate();
            if (!isPromise(ret)) {
              if (focus.isActivating()) {
                throw new Error(`Internal error: focus.activate() didn't return a promise (got a '${
                    typeof ret}') but focus is still in Activating phase`);
              }
              return component.render(); // Retry from beginning.
            }
            break;
        }
      }
    }
  } catch (error) {
    if (!tryConnectToMissingPartitionsAndThen(error, () => component.forceUpdate())) {
      throw error;
    }
    ret = component.tryRenderLensRole("connectingLens",
        (error.originalError || error).missingPartitions.map(entry => String(entry)));
  }
  /*
  finally {
    console.log("\trender ret:", ret);
  }
  //*/
  if (isPromise(ret)) {
    ret.then(() => component.forceUpdate());
    ret = component.tryRenderLensRole("pendingLens", { renderResult: ret });
    if (isPromise(ret)) {
      const error = wrapError(new Error("Invalid render result: 'pendingLens' returned a promise"),
          `During ${component.debugId()}\n .render().ret.pendingLens, with:`,
          "\n\pendingLens ret:", dumpObject(ret),
          "\n\tcomponent:", dumpObject(component));
      ret = component.tryRenderLensRole("internalErrorLens", error);
      if (isPromise(ret)) {
        const secondError = wrapError(error,
            `During ${component.debugId()}\n .render().ret.internalErrorLens, with:`,
            "\n\tinternalFailureLens ret:", dumpObject(ret));
        outputError(secondError);
        throw new Error(
            "The lens handling the role 'internalErrorLens' must never return a promise");
      }
    }
  }
  // console.log(`${component.debugId()}.render() ret:`, ret, component);
  return (typeof ret !== "undefined") ? ret
      : null;
}

function _renderFirstAlternate (
    component: UIComponent, focus: any, alternates: any[], lensName: string) {
  for (const alternate of arrayFromAny(alternates)) {
    const ret = component.renderLens(alternate, focus, lensName);
    if (ret !== null) return ret;
  }
  return null;
}

export function _tryRenderLensRole (component: UIComponent,
    roleName?: string, roleSymbol?: Symbol, focus: any, rootName: string,
    checkIfAvailable?: boolean): void | null | string | React.Element<any> | [] | Promise<any> {
  const Valaa = component.getValaa();
  const actualRoleName = roleName || Valaa.Lens[roleSymbol];
  const actualRoleSymbol = roleSymbol || Valaa.Lens[roleName];
  if (!actualRoleSymbol) throw new Error(`No Valaa.Lens role symbol for '${actualRoleName}'`);
  if (!actualRoleName) throw new Error(`No Valaa.Lens role name for '${String(actualRoleSymbol)}'`);
  if (checkIfAvailable) {
    const descriptor = component.context.engine.getHostObjectDescriptor(actualRoleSymbol);
    if (descriptor
        && (typeof descriptor.isLensAvailable === "function")
        && !descriptor.isLensAvailable(focus, component)) {
      return undefined;
    }
  }
  let assignee;
  try {
    assignee = component.props[actualRoleName];
    if (typeof assignee === "undefined") {
      if (component.props.hasOwnProperty(actualRoleName)) {
        throw new Error(`Render role props.${actualRoleName
            } is specified but its value is undefined`);
      }
      assignee = component.getUIContextValue(actualRoleSymbol);
      if (Array.isArray(assignee) && !Object.isFrozen(assignee)) assignee = [...assignee];
      if (typeof assignee === "undefined") {
        assignee = component.context[actualRoleName];
        if (typeof assignee === "undefined") return undefined;
      }
    }
    return component.renderLens(assignee, focus, rootName);
  } catch (error) {
    throw wrapError(error,
        `During ${component.debugId()}\n ._tryRenderLensRole, with:`,
        "\n\tfocus:", focus,
        "\n\tactualRoleName:", actualRoleName,
        "\n\tactualRoleSymbol:", actualRoleSymbol,
        "\n\tassignee:", assignee);
  }
}

export function _renderFocusAsSequence (component: UIComponent,
    foci: any[], EntryElement: Object, entryProps: Object,
    keyFromFocus: (focus: any, index: number) => string,
): [] {
  // Wraps the focus entries EntryElement, which is UIComponent by default.
  // Rendering a sequence focus can't be just a foci.map(_renderFocus) because individual entries
  // might have pending kueries or content downloads.
  const parentUIContext = component.getUIContext();
  const parentKey = component.getUIContextValue("key") || "-";
  return arrayFromAny(foci).map((focus, forIndex) => {
    const props = {
      ...entryProps,
      focus,
      parentUIContext,
      context: { forIndex, focusSequenceIndex: forIndex },
      key: keyFromFocus ? keyFromFocus(focus, forIndex)
        : (focus instanceof Vrapper) ? `@${focus.getRawId().slice(0, 13)}<-${parentKey}`
        : `[${typeof forIndex !== "undefined" ? forIndex : "-"}]${parentKey}`,
    };
    return _wrapElementInLiveProps(
        component,
        React.createElement(EntryElement, props, ...arrayFromAny(component.props.children)),
        props.key);
  });
}

export function _renderFocus (component: UIComponent,
    focus: any
): null | string | React.Element<any> | [] | Promise<any> {
  if (!component.preRenderFocus) {
    return component.renderLensSequence(component.props.children, focus);
  }
  const preRendered = component.preRenderFocus(focus);
  const ret = component.tryRenderLens(preRendered, focus, "renderRoot");
  if (typeof ret !== "undefined") return ret;
  if (typeof preRendered === "object") return preRendered;
  const key = component.getUIContextValue("key");
  if (key) return <span key={key}>{preRendered}</span>;
  return <span>{preRendered}</span>;
}

export function _tryRenderLensArray (component: UIComponent,
    lensArray: any[], focus: any, lensName?: string
): void | [] | Promise<any[]> {
  let ret; // remains undefined if no entry tryRenderLens makes any changes
  let hasPromise;
  for (let i = 0; i !== lensArray.length; ++i) {
    const processedEntry = component.tryRenderLens(
        lensArray[i], focus, `#${String(i)}-${lensName || ""}`);
    if (typeof processedEntry !== "undefined") {
      if (isPromise(processedEntry)) hasPromise = true;
      if (!ret) ret = lensArray.slice(0, i);
      ret.push(processedEntry);
    } else if (ret) ret.push(lensArray[i]);
  }
  if (hasPromise) ret = Promise.all(ret);
  return ret;
}

let _ValaaScope;

export function _tryRenderLens (component: UIComponent, lens: any, focus: any,
    lensName: string
): void | null | string | React.Element<any> | [] | Promise<any> {
  switch (typeof lens) {
    case "undefined":
      return null;
    case "function": {
      const contextThis = component.getUIContextValue("component");
      return component.renderLens(lens.call(contextThis, focus, component, lensName),
          focus, lensName);
    }
    case "object":
      if ((lens === null) || isPromise(lens)) {
        return undefined;
      }
      if (React.isValidElement(lens)) {
        return _tryWrapElementInLiveProps(component, lens, lensName);
      }
      if (lens instanceof Kuery) {
        const subName = `kuery-${lensName}`;
        // Delegates the kuery resolution to LiveProps.
        return _wrapElementInLiveProps(component,
            React.createElement(UIComponent,
                component.childProps(subName, {}, { overrideLens: [lens] })),
            subName);
      }

      if (lens instanceof Vrapper) {
        const blocker = lens.activate();
        if (blocker) return blocker;
        if (lens.hasInterface("Media")) {
          const { mediaInfo, mime } = lens.resolveMediaInfo();
          return component.renderLens(lens.interpretContent({ mediaInfo, mime }), focus,
              `${mediaInfo.name}:${mime}-${lensName}`);
        }
        console.error("DEPRECATED, SUBJECT TO CHANGE:",
            "VSX notation `{focus.foo}` sets focus.foo as the new focus, for now",
            "\n\tprefer: `{{ focus: focus.foo }}` (ie no-scope syntax) to set focus",
            "\n\tchange: the compact notation will be used for rendering focus.foo",
            "as a _lens_, WITHOUT changing the focus.",
            "\n\tin component:", component.debugId(), component);
        return React.createElement(
            _ValaaScope || (_ValaaScope = require("../ValaaScope").default),
            component.childProps(`legacy-focus-${lensName}`, { focus: lens }, {}));
      }
      if (Array.isArray(lens)) {
        return _tryRenderLensArray(component, lens, focus);
      }
      if (Object.getPrototypeOf(lens) === Object.prototype) {
        if (lens.overrideLens && (Object.keys(lens).length === 1)) {
          return _renderFirstAlternate(component, focus, lens.overrideLens, lensName);
        }
        const subName = `noscope-${lensName}`;
        return _wrapElementInLiveProps(component,
            React.createElement(
                _ValaaScope || (_ValaaScope = require("../ValaaScope").default),
                component.childProps(subName, {}, { ...lens })),
            subName);
      }
      if (!isSymbol(lens)) {
        throw new Error(`Invalid lens value when trying to render ${lensName
            }, got value of type '${lens.constructor.name}'`);
      }
    // eslint-disable-next-line no-fallthrough
    case "symbol":
      return component.renderLensRole(lens, focus);
    default:
      break;
  }
  return undefined;
}

export function _wrapElementInLiveProps (component: UIComponent, element: Object, name?: string) {
  const ret = _tryWrapElementInLiveProps(component, element, name);
  return (typeof ret !== "undefined") ? ret
      : element;
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
function _tryWrapElementInLiveProps (component: UIComponent, element: Object, lensName?: string) {
  const LiveProps = _LiveProps || (_LiveProps = require("./LiveProps").default);

  if ((element.type === LiveProps)
      || LiveProps.isPrototypeOf(element.type)) return undefined;
  const { type, props, ref, key } = element;
  const liveProps = { currentIndex: 0 };
  const livePropLookup = new Map(); // deduplicate identical kueries
  let liveElementProps;
  function _obtainLiveElementProps () {
    if (!liveElementProps) liveElementProps = { ...props };
    return liveElementProps;
  }
  try {
    for (const propName of Object.keys(props)) {
      if ((propName === "children")
          || (type.noPostProcess && type.noPostProcess[propName])) continue;
      const newProp = _postProcessProp(
          props[propName], livePropLookup, liveProps, propName, component);
      if (typeof newProp !== "undefined") {
        _obtainLiveElementProps()[propName] = newProp;
      }
    }
    if (ref && (ref instanceof Kuery)) {
      // Rewrite ref kuery as refKuery so that LiveProps can evaluate it.
      _obtainLiveElementProps().refKuery =
          _postProcessProp(ref, livePropLookup, liveProps, "ref", component);
    }
    if (isUIComponentElement(element)) {
      if (!liveElementProps) {
        // If UIComponent has no live props and already has a uiContext/parentUIContext no
        // processing is required now: The UIComponent does its own post-processing.
        const hasUIContext = props.uiContext || props.parentUIContext;
        if ((key || !lensName) && hasUIContext) return undefined;
        // Otherwise provide the current component context as the parentUIContext for the component.
        const newProps = { ...props };
        delete newProps.children;
        if (key || lensName) newProps.key = key || lensName;
        if (!hasUIContext) newProps.parentUIContext = component.getUIContext();
        /*
        console.log("_tryWrapElementInLiveProps UIComponent", type.name, newProps,
            "\n\toriginal props:", props,
            "\n\toriginal element:", element,
            "\n\tparent component:", component);
        */
        return React.createElement(type, newProps, ...arrayFromAny(props.children));
      }
      // UIComponent with live props does its own path kuery management, Wrapper needs to only
      // manage the props.
    } else if (props.hasOwnProperty("kuery")) {
      // Non-UIComponent elements which have specified a kuery need to be managed even if there are
      // no live props.
      throw new Error(`DEPRECATED: props.kuery\n\tprefer: props.valaaScope.focus${
          ""}\n\talternatively for Valaa components: props.focus${
          ""}\n\tin component: ${component.debugId()}`);
      /*
      delete _obtainLiveElementProps().kuery;
      assistantPropsOptions = {
        name, parentUIContext: component.getUIContext(), kuery: props.kuery
      };
      */
    } else if (!liveElementProps) {
      // non-UIComponent element with no live props: post-process its children directly here.
      const processedChildren = component.tryRenderLensSequence(props.children);
      if ((key || !lensName) && (typeof processedChildren === "undefined")) return undefined;
      if (isPromise(processedChildren)) return processedChildren;
      const newProps = { ...props };
      delete newProps.children;
      if (key || lensName) newProps.key = key || lensName;
      return React.createElement(type, newProps,
          ...(processedChildren || arrayFromAny(props.children)));
    } else {
      // non-UIComponent element with live props. Prepare live wrapper kuery options.
      // Because wrapper doesn't touch its uiContext we can forward our own to it.
    }
    let livePropsProps: any = { elementType: type, elementProps: liveElementProps };
    if (liveProps.currentIndex) {
      delete liveProps.currentIndex;
      livePropsProps.liveProps = liveProps;
    }
    livePropsProps = uiComponentProps({
      name: key ? `live-${key}` : lensName,
      parentUIContext: component.getUIContext(),
    }, livePropsProps);
    // console.log("_tryWrapElementInLiveProps LiveWrapper for", type.name, wrapperProps);
    /* Only enable this section for debugging React key warnings; it will break react elsewhere
    const DebugLiveProps = class DebugLiveProps extends LiveProps {};
    Object.defineProperty(DebugLiveProps, "name", {
      value: `LiveProps_${livePropsProps.key}`,
    });
    //*/
    return React.createElement(LiveProps, livePropsProps, ...arrayFromAny(props.children));
  } catch (error) {
    throw wrapError(error, `During ${component.debugId()}\n ._tryWrapElementInLiveProps(`,
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

export function _validateElement () {
  return; // validation disabled until needed
}

/*
export function _validateElement (component: UIComponent, element: any) {
  const faults = _recurseValidateElements(element);
  if (faults) {
    console.warn("Element validation failure in", component.debugId(), component,
        "\n\tfaults:", faults);
  }
}

function _recurseValidateElements (element: any) {
  if (Array.isArray(element)) {
    const faults = element.map(_recurseValidateElements);
    return typeof faults.find(entry => typeof entry !== "undefined") !== "undefined"
        ? faults
        : undefined;
  }
  if (!React.isValidElement(element)) return undefined;
  const ret = {};
  if (typeof element.key === "undefined") ret.keyFault = "key missing";
  const childFaults = _recurseValidateElements(element.children);
  if (typeof childFaults !== "undefined") ret.childFaults = childFaults;
  if (!Object.keys(ret).length) return undefined;
  ret.element = element;
  return ret;
}
*/
