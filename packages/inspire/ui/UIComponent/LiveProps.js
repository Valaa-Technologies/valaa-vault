// @flow

import React from "react";
import PropTypes from "prop-types";
import { OrderedMap } from "immutable";

import { tryConnectToMissingPartitionsAndThen } from "~/raem/tools/denormalized/partitions";
import { Kuery } from "~/raem/VALK";

import Vrapper, { LiveUpdate, getImplicitCallable } from "~/engine/Vrapper";
import VALEK from "~/engine/VALEK";
import getImplicitMediaInterpretation from "~/engine/Vrapper/getImplicitMediaInterpretation";

import Valoscope from "~/inspire/ui/Valoscope";
import UIComponent from "~/inspire/ui/UIComponent";

import {
  arrayFromAny, patchWith, dumpObject, isPromise, thenChainEagerly, wrapError,
} from "~/tools";

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
  static mainLensSlotName = "livePropsLens";

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

  componentWillReceiveProps (nextProps: Object, nextContext: Object) {
    super.componentWillReceiveProps(nextProps, nextContext,
        nextProps.liveProps !== this.props.liveProps);
  }

  _currentSheetContent: ?Object;
  _currentSheetObject: ?Object;

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
      mimeFallback: "text/css", synchronous: undefined, discourse: this.context.engine.discourse,
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

    let newProps = { ...this.props.elementProps };
    let pendingProps;
    for (const name of Object.keys(this.props.elementProps)) {
      const prop = this.props.elementProps[name];
      if ((typeof prop === "function") && prop.kueryId) {
        newProps[name] = prop(this.state.livePropValues);
        if (((name.slice(0, 2) === "on") || (name === "refKuery"))
            && (typeof newProps[name] !== "function")) {
          newProps[name] = getImplicitCallable(newProps[name], `props.${name}`,
              { synchronous: undefined });
        }
      }
      if (name === "className") {
        newProps[name] = this.refreshClassName(focus, newProps[name]);
      }
      if (isPromise(newProps[name])) (pendingProps || (pendingProps = {}))[name] = newProps[name];
    }
    if (pendingProps) {
      const pendingPropsNames = Object.keys(pendingProps);
      const ret = Promise.all(pendingPropsNames.map(name => pendingProps[name])).then((values) => {
        this.setState((prevState) => ({
          livePropValues: pendingPropsNames.reduce((newLivePropsValues, name, index) =>
                  newLivePropsValues.set(name, values[index]),
              prevState.livePropValues || OrderedMap())
        }));
      });
      ret.operationInfo = {
        slotName: "pendingPropsLens", focus: pendingProps,
        onError: { slotName: "failedPropsLens", propsNames: pendingPropsNames },
      };
      return ret;
    }

    if (newProps.refKuery) {
      newProps.ref = newProps.refKuery;
      delete newProps.refKuery;
    }
    for (const propName of Object.getOwnPropertyNames(newProps)) {
      if (typeof newProps[propName] === "function") {
        newProps[propName] = this._wrapInValOSExceptionProcessor(newProps[propName], propName);
      }
    }
    let children = arrayFromAny(this.props.children);
    let elementType = this.props.elementType;
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
    let ret;
    if (newProps.delegate && (Object.keys(newProps).length === 1)) {
      ret = this.renderFirstEnabledDelegate(newProps.delegate, undefined, "delegate");
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
    } else if (!elementType.isUIComponent || !newProps.hasOwnProperty("array")) {
      if (!newProps.key) newProps.key = newProps.elementKey || this.getUIContextValue("key");
      const inter = React.createElement(elementType, newProps, ...children);
      ret = _wrapElementInLiveProps(this, inter, focus, "focus");
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
        const connectingMissingPartitions = tryConnectToMissingPartitionsAndThen(error,
            () => handleCallbackExceptions(...args));
        if (connectingMissingPartitions) return connectingMissingPartitions;
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
