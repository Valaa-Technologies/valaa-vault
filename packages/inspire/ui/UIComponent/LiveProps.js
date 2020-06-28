// @flow

import React from "react";
import PropTypes from "prop-types";
import { OrderedMap } from "immutable";

import { tryConnectToAbsentChroniclesAndThen } from "~/raem/tools/denormalized/partitions";
import { Kuery } from "~/raem/VALK";

import Vrapper, { LiveUpdate, getImplicitCallable } from "~/engine/Vrapper";
import VALEK from "~/engine/VALEK";
import getImplicitMediaInterpretation from "~/engine/Vrapper/getImplicitMediaInterpretation";

import Valoscope from "~/inspire/ui/Valoscope";
import UIComponent from "~/inspire/ui/UIComponent";

import {
  arrayFromAny, patchWith, dumpObject, isPromise, thenChainEagerly, wrapError,
} from "~/tools";

import {
  wrapElementInLiveProps, tryCreateLivePropsProps, LivePropsPropsTag,
} from "./_livePropsOps";

export { wrapElementInLiveProps, tryCreateLivePropsProps, LivePropsPropsTag };

const _isReservedPropsName = {
  key: true,
  globalId: true,
  children: true,
  style: true,
  styleSheet: true,
  focus: true,
  array: true,
  frame: true,
  context: true,
  className: true,
  lens: true,
  lensProperty: true,
  focusLensProperty: true,
  delegateLensProperty: true,
  instanceLensProperty: true,
  instanceLensPrototype: true,
  // all names which begin with "on" and are followed by an uppercase letter
  // all names which end with "Lens"
};

/* eslint-disable react/prop-types */

/**
 * An UIComponent which wraps another element of given
 * props.elementType and manages its live props.
 *
 * Live props are passed into LiveProps through props.liveProps (a map
 * of string kuery key to live kuery). LiveProps keeps track of these
 * kueries (valked from parentUIContext.focus) and maintains their
 * current values in corresponding map of kuery key to current value.
 *
 * When rendering the element, props.elementProps are pre-processed and
 * props values which are callback functions will be called with the
 * live value map and the return values used as the final
 * prop value that is passed to the element. This roughly mimics
 * following JSX:
 *
 * <props.elementType {...processedProps}>{this.props.children}</props.elementType>
 *
 * The element can be any element, even another UIComponent; however
 * such an UIComponent won't receive any special treatment and will
 * need to receive its props through props.elementProps.
 *
 * Note: as LiveProps is an UIComponent it can be passed the normal
 * UIComponent props like props.uiContext or props.parentUIContext and
 * props.kuery: however the resulting local uiContext.focus will not
 * affect the live props and is only used for the children (if any).
 *
 * @export
 * @class LiveProps
 * @extends {UIComponent}
 */
export default class LiveProps extends UIComponent {
  static mainLensSlotName = "livePropsLens";

  static propTypes = {
    ...UIComponent.propTypes,
    elementType: PropTypes.any.isRequired,
    elementProps: PropTypes.object.isRequired,
    liveProps: PropTypes.object, // Must be Map
    onRef: PropTypes.instanceOf(Kuery),
  }
  static noPostProcess = {
    ...UIComponent.noPostProcess,
    liveProps: true,
    onRef: true,
  }

  constructor (props: any, context: any) {
    super(props, context, { livePropValues: null });
  }

  bindFocusSubscriptions (focus: any, props: Object) {
    super.bindFocusSubscriptions(focus, props);
    // Live props are always based on the parent focus.
    // Now uselessly reattaching listeners if the local focus changes.
    let frame = this.getUIContextValue("frame");
    if (frame === undefined) frame = {};
    let livePropValues = OrderedMap();
    (Object.keys(props.liveProps) || []).forEach(kueryId => {
      const bindingSlot = `LiveProps_propskuery_${kueryId}`;
      const kuery = props.liveProps[kueryId];
      thenChainEagerly(null, [
        this.bindLiveKuery.bind(this, bindingSlot, frame, kuery,
            { asRepeathenable: true, scope: this.getUIContext() }),
        (liveUpdate: LiveUpdate) => {
          const update = value => {
            const current = livePropValues || this.state.livePropValues || OrderedMap();
            if ((value === current.get(kueryId))
                && ((value !== undefined) || current.has(kueryId))) {
              return;
            }
            this.setState((prevState) => ({
              livePropValues: (prevState.livePropValues || OrderedMap()).set(kueryId, value),
            }));
          };
          const maybePromise = liveUpdate.value();
          if (livePropValues) livePropValues = livePropValues.set(kueryId, maybePromise);
          if (isPromise(maybePromise)) maybePromise.then(update);
          else if (!livePropValues) update(maybePromise);
        },
      ], this._errorOnBindFocusSubscriptions.bind(this, bindingSlot, kuery));
    });
    this.setState(prev => {
      const ret = { livePropValues: (prev.livePropValues || OrderedMap()).merge(livePropValues) };
      livePropValues = undefined;
      return ret;
    });
  }

  _errorOnBindFocusSubscriptions (bindingSlot, kuery, error) {
    this.enableError(wrapError(error,
            new Error(`bindFocusSubscriptions('${bindingSlot}')`),
            "\n\tuiContext:", ...dumpObject(this.state.uiContext),
            "\n\tfocus:", ...dumpObject(this.tryFocus()),
            "\n\tkuery:", ...dumpObject(kuery),
            "\n\tstate:", ...dumpObject(this.state),
            "\n\tprops:", ...dumpObject(this.props)),
        `Exception caught during LiveProps.bindFocusSubscriptions('${bindingSlot}')`);
  }

  unbindSubscriptions () {
    super.unbindSubscriptions();
    this.setState({ livePropValues: null });
  }

  shouldComponentUpdate (nextProps: Object, nextState: Object) {
    if (nextState.livePropValues !== this.state.livePropValues) return true;
    if (nextProps !== this.props) return true;
    return false;
  }

  UNSAFE_componentWillReceiveProps (nextProps: Object, nextContext: Object) { // eslint-disable-line
    super.UNSAFE_componentWillReceiveProps(nextProps, nextContext,
        nextProps.liveProps !== this.props.liveProps);
  }

  _currentSheetContent: ?Object;
  _currentSheetObject: ?Object;

  readSlotValue (slotName: string, slotSymbol: Symbol, focus: any, onlyIfAble?: boolean) {
    // Use the props slots of the parent component because LiveProps
    // cannot be explicitly passed any props.
    // These slot props should probably be passed to LiveProps inside props, though...
    return super.readSlotValue(slotName, slotSymbol, focus, onlyIfAble,
        ((this.props.parentUIContext || {}).reactComponent || this).props);
  }

  refreshClassName (focus: any, value: any) {
    if ((value == null) || !(value instanceof Vrapper)) return value;
    const bindingSlot = `props_className_content`;
    if (value.hasInterface("Media") && !this.getBoundSubscription(bindingSlot)) {
      this.bindLiveKuery(bindingSlot, value, VALEK.toMediaContentField(), {
        onUpdate: function updateClassContent () {
          if (this.tryFocus() !== focus) return false;
          return this.forceUpdate() || undefined;
        }.bind(this),
        updateImmediately: false,
      });
    }
    const sheetContent = getImplicitMediaInterpretation(value, bindingSlot, {
      fallbackContentType: "text/css",
      synchronous: undefined,
      discourse: this.context.engine.discourse,
    });
    if ((sheetContent == null) || isPromise(sheetContent)) return sheetContent;
    if (this._currentSheetContent !== sheetContent) {
      if (this._currentSheetContent) this.context.releaseVssSheets(this);
      this._currentSheetContent = sheetContent;
      const sheet = {};
      if (sheetContent.html) patchWith(sheet, sheetContent.html);
      if (sheetContent.body) patchWith(sheet, sheetContent.body);
      for (const [selector, styles] of Object.entries(sheetContent)) {
        if ((selector !== "body") && (selector !== "html")) {
          sheet[`& .${selector}`] = styles;
        }
      }
      this._currentSheetObject = this.context.getVSSSheet({ sheet }, this);
    }
    return this._currentSheetObject.classes.sheet;
  }

  renderLoaded (focus: any) {
    if (this.props.liveProps) {
      const unfinishedKueries = [];
      const livePropValues = this.state.livePropValues || OrderedMap();
      for (const kueryId of Object.keys(this.props.liveProps)) {
        if (!livePropValues.has(kueryId)) {
          unfinishedKueries.push({ [kueryId]: this.props.liveProps[kueryId] });
        }
      }
      if (unfinishedKueries.length) {
        return this.renderSlotAsLens("kueryingPropsLens", unfinishedKueries);
      }
    }

    let newProps = {};
    let pendingProps;
    let elementType = this.props.elementType;
    const isValoscope = (elementType === Valoscope);

    for (let [name, prop] of Object.entries(this.props.elementProps)) {
      if ((typeof prop === "function") && prop.kueryId) {
        prop = prop(this.state.livePropValues);
      }
      if (isPromise(prop)) {
        (pendingProps || (pendingProps = [])).push([name, prop]);
      }
      if (pendingProps) continue;
      if (name[0] === "$") {
        const propsContext = (newProps.context || (newProps.context = {}));
        if (name.startsWith("$P.") || name.startsWith("$C.")) {
          propsContext[name.slice(3)] = prop;
        } else {
          const index = name.indexOf(".");
          if (index === -1) throw new Error(`Namespace props is missing separator: '${name}'`);
          const namespace = name.slice(0, index);
          (propsContext[namespace] || (propsContext[namespace] = {}))[name.slice(index + 1)] = prop;
        }
        continue;
      } else if (!_isReservedPropsName[name]) {
        if (name.startsWith("on") && (!isValoscope || (name[2] === name[2].toUpperCase()))) {
          if (typeof prop !== "function") {
            prop = getImplicitCallable(prop, `props.${name}`, { synchronous: undefined });
          }
          if (name === "onRef") {
            name = "ref";
          }
        }
      } else if (name === "className") {
        prop = this.refreshClassName(focus, prop);
      } else if (name === "delegate") {
        if (Object.keys(this.props.elementProps).length === 1) {
          return this.renderFirstEnabledDelegate(prop, undefined, "delegate");
        }
      } else if (name === "context" && newProps.context) {
        Object.assign(newProps.context, prop);
        continue;
      }
      if (typeof prop === "function") {
        prop = this._wrapInValOSExceptionProcessor(prop, name);
      }
      newProps[name] = prop;
    }
    if (pendingProps) {
      const ret = Promise.all(pendingProps.map(entry => entry[1])).then(resolvedProps => {
        this.setState((prevState) => ({
          livePropValues: pendingProps.reduce((newLivePropsValues, [name], index) =>
                  newLivePropsValues.set(name, resolvedProps[index]),
              prevState.livePropValues || OrderedMap())
        }));
      });
      ret.operationInfo = {
        slotName: "pendingPropsLens", focus: pendingProps,
        onError: { slotName: "failedPropsLens", propsNames: pendingProps.map(([name]) => name) },
      };
      return ret;
    }
    let children = arrayFromAny(this.props.children);
    if (!isValoscope) {
      const valoscopeProps = newProps.valoscope || newProps.vScope || newProps.valaaScope;
      if (valoscopeProps) {
        const subProps = newProps;
        newProps = valoscopeProps;
        delete subProps.valoscope;
        delete subProps.vScope;
        delete subProps.valaaScope;
        elementType = Valoscope;
        children = [React.createElement(elementType, subProps, ...children)];
      }
    }
    let ret;
    /* Only enable this section for debugging React key warnings; it will break react elsewhere
    if (elementType === Valoscope) {
      elementType = class DebugValoscope extends Valoscope {};
      Object.defineProperty(elementType, "name", {
        value: `Valoscope_${newProps.className || ""}${this.getUIContextValue("key")}`,
      });
    }
    /* */
    // eslint-disable-next-line
    // */
    if (!elementType.isUIComponent || !newProps.hasOwnProperty("array")) {
      if (!newProps.key) newProps.key = newProps.globalId || this.getUIContextValue("key");
      const inter = React.createElement(elementType, newProps, ...children);
      ret = wrapElementInLiveProps(this, inter, focus, "focus");
    } else {
      const array = newProps.array;
      if ((array == null) || (typeof array[Symbol.iterator] !== "function")) {
        ret = this.renderSlotAsLens("arrayNotIterableLens", array);
      } else {
        delete newProps.array;
        if (children.length) newProps.children = children;
        ret = this.renderFocusAsSequence(
            Array.isArray(array) ? array : [...array], elementType, newProps);
      }
    }
    return ret;
  }

  _wrapInValOSExceptionProcessor (callback: Function, name: string) {
    const component = this;
    const ret = function handleCallbackExceptions (...args: any[]) {
      try {
        return callback.call(this, ...args);
      } catch (error) {
        const absentChronicleSourcings = tryConnectToAbsentChroniclesAndThen(error,
            () => handleCallbackExceptions(...args));
        if (absentChronicleSourcings) return absentChronicleSourcings;
        const finalError = wrapError(error,
            new Error(`props.${name} valospace callback`),
            "\n\targs:", args,
            "\n\tcontext:", component.state.uiContext,
            "\n\tstate:", component.state,
            "\n\tprops:", component.props,
        );

        component.enableError(finalError,
            "Exception caught during LiveProps.handleCallbackExceptions");
      }
      return undefined;
    };
    Object.defineProperty(ret, "name", { value: `handleExceptionsOf_${name}` });
    return ret;
  }
}
