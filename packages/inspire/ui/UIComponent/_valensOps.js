// @flow

import React from "react";

import { Kuery } from "~/raem/VALK";

import UIComponent, { isUIComponentElement } from "./UIComponent";
import { _valensRecorderProps, _emitValoscopeRecorderProps } from "./_liveOps";

import { arrayFromAny, dumpObject, isPromise, wrapError } from "~/tools";

export const ValensPropsTag = Symbol("Valens.props");

export function wrapElementInValens (component: UIComponent, element: Object, focus: any,
    hierarchyKey?: string, extendContext?: Object) {
  const ret = tryWrapElementInValens(component, element, focus, hierarchyKey, extendContext);
  return (ret !== undefined) ? ret : element;
}

let _Valens;

/**
 * If no hierarchyKey is provided then it means the component doesn't
 * necessarily need one.
 *
 * @export
 * @param {UIComponent} component
 * @param {Object} element
 * @param {string} [name]
 * @returns
 */
export function tryWrapElementInValens (component: UIComponent, element: Object, focus: any,
    hierarchyKey?: string, extendContext?: Object) {
  // TODO(iridian, 2020-06): This whole setup should be implemented in
  // JSXDecoder also, then deprecated here, and finally removed from
  // here.
  if (element.type.isValens && !extendContext) return undefined;
  let valensArgs = element[ValensPropsTag];
  try {
    if (valensArgs === undefined) {
      valensArgs = tryCreateValensArgs(
          element.type, element.props, hierarchyKey, element.key, element.ref);
    }
    if (valensArgs) {
      // console.log("tryWrapElementInValens LiveWrapper for", elementType.name, wrapperProps);
      /* Only enable this section for debugging React key warnings; it
      will break react elsewhere
      const DebugValens = class DebugValens extends Valens {};
      Object.defineProperty(DebugValens, "name", {
        value: `Valens_${valensProps.key}`,
      });
      // */
      const props = _mergeExtendContextToProps(extendContext, valensArgs[1]);
      return React.createElement(valensArgs[0], props, ...arrayFromAny(element.props.children));
    }
    return tryPostRenderElement(component, element, focus, hierarchyKey, extendContext);
  } catch (error) {
    throw wrapError(error, `During ${component.debugId()}\n .tryWrapElementInValens(`,
            typeof element.type === "function" ? element.type.name : element.type, `), with:`,
        "\n\telement.props:", element.props,
        "\n\telement.props.children:", element.props && element.props.children,
    );
  }
}

function _mergeExtendContextToProps (context, props) {
  if (!context) return props;
  if (!props.context) return { ...props, context };
  return { ...props, context: { ...props.context, ...context } };
}

export function postRenderElement (component, element, focus, hierarchyKey, extendContext) {
  const ret = tryPostRenderElement(component, element, focus, hierarchyKey, extendContext);
  return (ret !== undefined) ? ret : element;
}

export function tryPostRenderElement (component, element, focus, hierarchyKey, extendContext) {
  let processedProps;
  if (isUIComponentElement(element)) {
    // const hasUIContext = props.parentUIContext;
    // If an UIComponent element isn't provided a parentUIContext
    // explicitly then the current component context is provided as
    // the parentUIContext.
    // if (!hasUIContext) parentUIContext = component.getUIContext();
    // Otherwise if the UIComponent has a key no pre-processing
    // is required now. UIComponent does its own post-processing.
    // else
    if (!element.key && hierarchyKey) {
      processedProps = { ...element.props, key: hierarchyKey };
      if (extendContext) {
        processedProps.context = !processedProps.context
            ? extendContext
            : Object.assign(processedProps.context, extendContext);
      }
    } else if (extendContext) {
      processedProps = _mergeExtendContextToProps(extendContext, element.props);
    }
  } else if (extendContext) {
    return React.createElement(UIComponent, { context: extendContext }, element);
  } else {
    // non-UIComponent sans live props has its children directly rendered.
    const children = component.tryRenderLensSequence(element.props.children, focus, hierarchyKey);
    if (children === undefined) {
      if (!element.key && hierarchyKey) processedProps = { ...element.props, key: hierarchyKey };
    } else if (isPromise(children)) {
      children.operationInfo = Object.assign(children.operationInfo || {}, {
        slotName: "pendingElementsLens", focus: element.props.children,
        onError: { slotName: "rejectedElementsLens", children: element.props.children },
      });
      return children;
    } else {
      processedProps = { ...element.props, key: element.key || hierarchyKey, children };
    }
  }
  if (!processedProps) return undefined;
  if (element.ref) processedProps.ref = element.ref;
  return React.createElement(element.type, processedProps);
}

export function tryCreateValensArgs (
    elementType, elementProps, hierarchyKey, elementKey, elementRef) {
  const Valens = _Valens || (_Valens = require("./Valens").default);
  if (elementType.isValens) return undefined;
  let valensProps, rerunAfterPriming, currentIndex = 0;
  const propValensBehaviors = !elementType.isUIComponent
          ? _nonComponentPropValensBehaviors
      : (elementType.isValoscope)
          ? _valoscopePropValensBehaviors
      : _uiComponentPropValensBehaviors;
  try {
    do {
      rerunAfterPriming = false;
      if (elementKey && _evaluateProp("key", elementKey)) continue;
      if (elementRef && _evaluateProp("ref", elementRef)) continue;
      for (const [propName, propValue] of Object.entries(elementProps)) {
        if (_evaluateProp(propName, propValue)) break;
      }
    } while (rerunAfterPriming);
    return valensProps && [Valens, valensProps];
  } catch (error) {
    throw wrapError(error, `During _createValensProps(`,
            typeof elementType === "function" ? elementType.name : elementType, `), with:`,
        "\n\telement.props:", ...dumpObject(elementProps),
    );
  }
  function _evaluateProp (propName, propValue) {
    let actualName = propName, actualValue = propValue;
    const behavior = propValensBehaviors[propName];
    if (typeof behavior === "boolean") {
      if (behavior && valensProps) {
        // keep as valens props if present
        if (propName.startsWith("$Lens.")) actualName = actualName.slice(6);
        valensProps[actualName] = propValue;
      }
      return undefined;
    }
    if (!valensProps) {
      if ((behavior === undefined) && !(propValue instanceof Kuery)) return undefined;
      valensProps = { hierarchyKey, elementType, elementPropsSeq: [] };
      rerunAfterPriming = true;
      return true; // rerun all props from beginning
    }
    if (typeof behavior === "string") actualName = behavior;
    if (propValue instanceof Kuery) {
      const kueryName = `props.${propName}#${currentIndex++}`;
      (valensProps.propsKueriesSeq || (valensProps.propsKueriesSeq = []))
          .push([kueryName, propValue]);
      actualValue = _obtainFetchKueryProp(kueryName);
    }
    valensProps.elementPropsSeq.push([actualName, actualValue]);
    return undefined;
  }
}

const _valoscopePropValensBehaviors = {
  children: false,
  delayed: true,
  ...Object.fromEntries([
    ...Object.keys(_valensRecorderProps).map(name => [`$Lens.${name}`, `$Lens.${name}`]),
    ...Object.keys(_valensRecorderProps).map(name => [name, `$Lens.${name}`]),
  ]),
  key: undefined,
  ref: undefined,
  // "$Lens.frame": undefined,
  // "$Lens.ref": undefined,
};

const _uiComponentPropValensBehaviors = {
  children: false,
  delayed: true,
  ...Object.fromEntries([
    ...Object.keys(_valensRecorderProps).map(name => [`$Lens.${name}`, `$Lens.${name}`]),
    ...Object.keys(_valensRecorderProps).map(name => [name, `$Lens.${name}`]),
    ...Object.keys(_emitValoscopeRecorderProps).map(name => [`$Lens.${name}`, `$Lens.${name}`]),
    ...Object.keys(_emitValoscopeRecorderProps).map(name => [name, `$Lens.${name}`]),
  ]),
  key: undefined, // only if live
  ref: undefined, // only if live
  focus: undefined, // only if live
  // "$Lens.focus": "$Lens.focus",
};

const _nonComponentPropValensBehaviors = {
  children: false, // drop
  "$Lens.delayed": true,
  ...Object.fromEntries([
    ...Object.keys(_valensRecorderProps).map(name => [`$Lens.${name}`, `$Lens.${name}`]),
    ...Object.keys(_emitValoscopeRecorderProps).map(name => [`$Lens.${name}`, `$Lens.${name}`]),
  ]),
};

const _kueryPropFetchers = {};
function _obtainFetchKueryProp (kueryName: string) {
  let ret = _kueryPropFetchers[kueryName];
  if (!ret) {
    ret = _kueryPropFetchers[kueryName] = function _fetchKueryProp (kueryValues: Object) {
      try {
        return kueryValues[kueryName];
      } catch (error) {
        throw wrapError(error, `During _fetchKueryProp(${kueryName})`);
      }
    };
    ret.kueryName = kueryName;
  }
  return ret;
}
