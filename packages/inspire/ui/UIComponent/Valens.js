// @flow

import React from "react";
import PropTypes from "prop-types";

import Valoscope from "~/inspire/ui/Valoscope";
import UIComponent from "~/inspire/ui/UIComponent";

import { tryCreateValensArgs, ValensPropsTag, postRenderElement } from "./_valensOps";
import { _bindLiveSubscriptions, recordFrameKey, LensElementKey } from "./_liveOps";

const { symbols: Lens } = require("~/inspire/Lens");

export { tryCreateValensArgs, ValensPropsTag };

/* eslint-disable react/prop-types, complexity */

/**
 * An UIComponent which wraps another element of given
 * props.elementType and manages its live props.
 *
 * Live props are passed into Valens through props.propsKueriesSeq
 * (an array of kuery key - live kuery pairs). Valens keeps track of these
 * kueries (valked from parentUIContext.focus) and maintains their
 * current values in corresponding map of kuery key to current value.
 *
 * When rendering the element, props.elementPropsSeq are pre-processed and
 * props values which are callback functions will be called with the
 * live value map and the return values used as the final
 * prop value that is passed to the element. This roughly mimics
 * following JSX:
 *
 * <props.elementType {...processedProps}>{this.props.children}</props.elementType>
 *
 * The element can be any element, even another UIComponent; however
 * such an UIComponent won't receive any special treatment and will
 * need to receive its props through props.elementPropsSeq.
 *
 * Note: as Valens is an UIComponent it can be passed the normal
 * UIComponent props like props.parentUIContext: however the resulting
 * local uiContext.focus will not
 * affect the live props and is only used for the children (if any).
 *
 * @export
 * @class Valens
 * @extends {UIComponent}
 */
export default class Valens extends UIComponent {
  static isValens = true;
  static mainLensSlotName = "valensLens";

  static propTypes = {
    ...UIComponent.propTypes,
    sourceKey: PropTypes.string,
    hierarchyKey: PropTypes.string,
    elementType: PropTypes.any.isRequired,
    elementPropsSeq: PropTypes.arrayOf(PropTypes.any).isRequired,
    propsKueriesSeq: PropTypes.arrayOf(PropTypes.any),
  }

  getKey () {
    return this._key || this.getPrefixedHierarchyKey();
  }

  getPrefixedHierarchyKey () {
    const keyPrefix = this.getParentUIContextValue(Lens.frameStepPrefix) || "";
    return (this._key = (!keyPrefix
        ? this.props.hierarchyKey
        : `${keyPrefix}:${this.props.hierarchyKey}`));
  }

  getLexicalContext () {
    return (this.state.live || {}).localContext || this.state.uiContext;
  }

  bindFocusSubscriptions (focus: any, props: Object) {
    super.bindFocusSubscriptions(focus, props);
    // Live props are always based on the parent focus.
    _bindLiveSubscriptions(this, focus, props);
    return false;
  }

  unbindSubscriptions () {
    super.unbindSubscriptions();
    if (this.state.live) this.state.live.isUnbound = true;
    this.setState({ live: null });
  }

  shouldComponentUpdate (nextProps: Object, nextState: Object) {
    if (nextState.rerenderings !== this.state.rerenderings) return true;
    if ((nextState.live !== this.state.live) || (nextProps !== this.props)) {
      this._cachedRendering = undefined;
      return true;
    }
    return false;
  }

  UNSAFE_componentWillReceiveProps (nextProps: Object, nextContext: Object) { // eslint-disable-line
    super.UNSAFE_componentWillReceiveProps(nextProps, nextContext,
        nextProps.elementPropsSeq !== this.props.elementPropsSeq
            || nextProps.propsKueriesSeq !== this.props.propsKueriesSeq);
  }

  _currentSheetContent: ?Object;
  _currentSheetObject: ?Object;

  readSlotValue (slotName: string, slotSymbol: Symbol, focus: any, onlyIfAble?: boolean) {
    // Use the props slots of the parent component because Valens
    // cannot be explicitly passed any props.
    // These slot props should probably be passed to Valens inside props, though...
    return super.readSlotValue(slotName, slotSymbol, focus, onlyIfAble,
        ((this.context.parentUIContext || {})[Lens.nativeComponent] || this).props);
  }

  renderLoaded (focus: any) {
    const stateLive = this.state.live;
    if (!stateLive) return this.renderSlotAsLens("loadingLens");

    if (stateLive.delegate !== undefined) {
      return this.renderFirstEnabledDelegate(stateLive.delegate, undefined, "delegate");
    }
    if (stateLive.pendingProps) {
      const pendingPropNames = _refreshPendingProps(stateLive);
      if (pendingPropNames) {
        return this.renderSlotAsLens("pendingAttributesLens", pendingPropNames);
      }
    }

    let outerType = this.props.elementType;
    if (outerType === Valens) {
      throw new Error("INTERNAL ERROR: Valens..props.elementType 'Valens' disallowed");
    }
    let outerChildren = this.props.children;

    if (stateLive.frameOverrides) {
      // Denote that frame overrides object has been rendered and that
      // any new frame updates should create a new override object
      stateLive.frameOverrides = null;
    }
    let outerProps;
    if (!stateLive.valoscopeProps) {
      outerProps = stateLive.elementProps;
    } else {
      outerProps = stateLive.valoscopeProps;
      if (stateLive.elementProps) {
        outerType = Valoscope;
        outerChildren = stateLive.valoscopeChildren;
        if (!outerChildren) {
          stateLive.elementProps.children = this.props.children;
          outerChildren = stateLive.valoscopeChildren =
              React.createElement(this.props.elementType, stateLive.elementProps);
        }
      }
    }

    /* Only enable this section for debugging React key warnings; it will break react elsewhere
    if (elementType === Valoscope) {
      elementType = class DebugValoscope extends Valoscope {};
      Object.defineProperty(elementType, "name", {
        value: `Valoscope_${stateLive.elementProps.className || ""}${this.getKey()}`,
      });
    }
    /* */
    if (!stateLive.keyFromFocus) {
      recordFrameKey(stateLive, (outerType === Valoscope) ? Lens.frame : LensElementKey);
    }
    outerProps.children = outerChildren;

    if (stateLive.renderRejection === null) {
      stateLive.renderRejection = _createRenderRejection(stateLive);
    }

    if (stateLive.array) {
      if (!Array.isArray(stateLive.array)) {
        return this.renderSlotAsLens("arrayNotIterableLens", stateLive.array);
      }
      return this.renderFocusAsSequence(stateLive.array, outerType, outerProps, undefined,
          stateLive); // Note: stateLive has been designed to be used as options object here
    }
    const rejection = stateLive.renderRejection && stateLive.renderRejection(focus);
    if (rejection !== undefined) return rejection;
    outerProps.key = stateLive.keyFromFocus(focus, null, outerProps);
    return postRenderElement(this, React.createElement(outerType, outerProps), focus);
  }
}

function _refreshPendingProps (stateLive) {
  const kueryValues = stateLive.kueryValues;
  stateLive.pendingProps = stateLive.pendingProps
      .filter(([, kueryName]) => !kueryValues.hasOwnProperty(kueryName));
  if (stateLive.pendingProps.length) return stateLive.pendingProps.map(([name]) => name);
  stateLive.pendingProps = null;
  return undefined;
}

function _createRenderRejection (stateLive) {
  if (!stateLive.if) return focus => stateLive.component.renderLens(stateLive.else, focus);
  if (typeof stateLive.if !== "function") {
    return (stateLive.then === undefined)
        ? undefined
        : (focus => stateLive.component.renderLens(stateLive.then, focus));
  }
  return function _checkAndRenderRejection (focus, index) {
    const condition = stateLive.if(focus, index);
    return !condition
            ? stateLive.component.renderLens(stateLive.else, focus)
        : stateLive.then !== undefined
            ? stateLive.component.renderLens(stateLive.then, focus)
        : undefined;
  };
}
