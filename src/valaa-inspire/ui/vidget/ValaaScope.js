// @flow
import React from "react";
import PropTypes from "prop-types";

import Vrapper, { VrapperSubscriber } from "~/valaa-engine/Vrapper";
import VALEK, { dumpObject } from "~/valaa-engine/VALEK";
import UIComponent, { LENS, VSSStyleSheetSymbol } from "~/valaa-inspire/ui/base/UIComponent";
import { getLensByName } from "~/valaa-inspire/ui/helper/lens";

import { outputError, wrapError } from "~/valaa-tools";

/**
 * ValaaScope performs a semantically rich, context-aware render of its local UI focus according to
 * following rules:
 *
 * 1. If component is disabled (ie. its local UI context is undefined):
 *    value-renders (value-rendering defined in section 9.) props/context "disabledLens".
 *    disabledLens must not make any UI context nor UI focus references.
 *
 * 2. If main UI focus kuery is still pending (ie. UI focus is undefined):
 *    value-renders props/context "pendingLens", "loadingLens" or "disabledLens".
 *    A pending kuery is an asynchronous operation which hasn't returned the initial set of values.
 *    pendingLens can refer to UI context normally, but cannot refer to (still-undefined) UI focus.
 *
 * 3. If props.lens or context.lens is defined:
 *    value-renders props/context "lens".
 *    This allows overriding any further render semantics with a specific, hard-coded UI element
 *    which still knows that the main UI focus kuery has been completed.
 *    lens can refer to UI context and UI focus normally.
 *
 * 4. If UI focus is null:
 *    value-renders props/context "nullLens" or "disabledLens".
 *
 * 5. If UI focus is a string, a number, a React element, a function or a boolean:
 *    value-renders focus.
 *    This is the basic literal value rendering rule.
 *    Any React element or function content can refer to UI context and UI focus normally.
 *
 * 6. If UI focus is a Valaa resource, an appropriate Valaa Lens for it is located and rendered
 *    (with the resource set as its focus) as per rules below.
 *    Valaa Lens is a UI component which always has Valaa Resource as its focus.
 * 6.1. If UI focus is not an Active Valaa resource, ie. if any of its partitions does not have a
 *    fully formed active connection, then:
 * 6.1.1. If UI focus is an Inactive Valaa resource, ie. if some of its partitions are not connected
 *    and no connection attempt is being made:
 *    value-renders props/context "inactiveLens" or "disabledLens".
 * 6.1.2. If UI focus is an Activating Valaa resource, ie. if all of its partitions are either
 *    connected or a connection attempt is being made:
 *    value-renders props/context "activatingLens", "loadingLens" or "disabledLens".
 * 6.1.3. If UI focus is an Unavailable Valaa resource, ie. if some of its partitions connections
 *    have failed (due to networks issues, permission issues etc.):
 *    value-renders props/context "unavailableLens" or "disabledLens".
 * 6.1.4. If UI focus is a Destroyed Valaa resource:
 *    value-renders props/context "destroyedLens" or "disabledLens".
 * 6.2. If props.activeLens or context.activeLens is defined:
 *    value-renders props/context "activeLens".
 *    Like lens this overrides all further render semantics, but unlike lens
 *    the activeLens content can assume that UI focus is always a valid Valaa Resource.
 * 6.3. if either props.lensProperty or context.lensProperty is defined (lensProperty from hereon)
 *    and getFocus().propertyValue(lensProperty) is defined:
 *    value-renders getFocus().propertyValue(lensProperty).
 * 6.4. otherwise:
 *    value-renders props/context "fallbackLens" or "disabledLens".
 *
 * 7. If UI focus is an array or a plain object, ValaaScope behaves as if it was a ForEach component
 *    and renders the focus as a sequence, with following rules:
 * 7.1. all ValaaScope props which ForEach uses are forwarded to ForEach as-is,
 * 7.2. props.EntryUIComponent default value is ValaaScope instead of UIComponent,
 * 7.3. if UI focus is a plain object it is converted into an array using following rules:
 * 7.3.1. array entries are the UI focus object values, ordered lexicographically by their keys,
 * 7.3.2. the ForEach entry props (and thus the React key) for each entry element is created using
 *    childProps(key, { ... }) instead of uiComponentProps({ ... }).
 *
 * 8. Otherwise:
 *    throws a failure for unrecognized UI focus (ie. a complex non-recognized object)
 *
 * 9. value-render process renders a given value(s) directly ie. without further valaa or react
 *    operations), as follows:
 * 9.1. if value-render is given multiple values, the first one which is defined is used as value,
 * 9.2. if value === false, if value === null or if it is not defined:
 *    renders null.
 * 9.3. if value is a function:
 *    value-renders value(getUIContext()).
 *    The current UI focus can be found in getUIContext().focus.
 * 9.4. if value === true:
 *    renders props.children.
 * 9.5. if value is a string, number, or a React element:
 *    renders value.
 * 9.6. if value is a valaa Resource:
 *    renders <ValaaScope focus={value} />.
 * 9.7. otherwise:
 *    throws an exception for unrecognized value
 *
 * @export
 * @class ValaaScope
 * @extends {UIComponent}
 */
export default class ValaaScope extends UIComponent {
  static propTypes = {
    ...UIComponent.propTypes,
    lensName: PropTypes.oneOfType([PropTypes.string, PropTypes.arrayOf(PropTypes.string)]),
    lensProperty: PropTypes.oneOfType([PropTypes.string, PropTypes.arrayOf(PropTypes.string)]),
    fixedLens: PropTypes.any,
    lens: PropTypes.any,
    nullLens: PropTypes.any,
    activeLens: PropTypes.any,
    fallbackLens: PropTypes.any,
  };

  static contextTypes = {
    ...UIComponent.contextTypes,
    engine: PropTypes.object,
    styleSheet: PropTypes.any,
    lensProperty: PropTypes.oneOfType([PropTypes.string, PropTypes.arrayOf(PropTypes.string)]),
    nullLens: PropTypes.any,
    activeLens: PropTypes.any,
    fallbackLens: PropTypes.any,
    lensContext: PropTypes.object,
  };

  constructor (props: Object, context: Object) {
    super(props, context);
    this.liveKuerySubscribers = new Map();
  }

  liveKuerySubscribers: Map<string, Array<VrapperSubscriber>>;

  state: {
    focusResource: any,
    lensComponent: any,
  }

  attachSubscribers (focus: any, props: Object) {
    super.attachSubscribers(focus, props);
    this.setUIContextValue("this", this);
    let focusResource;
    if ((typeof this.tryRenderLensRole("fixedLens") === "undefined")
        && (typeof this.tryRenderLensRole("lens") === "undefined")
        && (typeof focus === "object") && (focus !== null) && (focus instanceof Vrapper)
        && (props.lensProperty || props.lensName || this.context.lensProperty
            || this.getUIContextValue(this.getValaa().Lens.lensProperty))) {
      if (props.lensName) {
        console.error("DEPRECATED: props.lensName\n\tprefer: props.lensProperty",
            "\n\tin component:", this.debugId(), this);
      }
      focusResource = focus;
    }
    this.setState({ focusResource, lensComponent: undefined },
        focusResource && (() => {
          this.attachLens(focusResource, props);
        }));
  }

  async attachLens (focus: Vrapper, props: Object) {
    const lens = await getLensByName(focus, props.lensProperty || props.lensName
        || this.getUIContextValue(this.getValaa().Lens.lensProperty)
        || this.context.lensProperty);
    if (!lens) {
      this.setState({ lensComponent: this.renderLensRole("fallbackLens") });
    } else if (!(lens instanceof Vrapper) || !lens.hasInterface("Media")) {
      this.setState({
        lensComponent: React.createElement(ValaaScope, { ...props, focus: lens }, props.children),
      });
    } else {
      this.attachKuerySubscriber("ValaaScope.lensComponent",
          lens, VALEK.toMediaContentField(), { onUpdate: async () => {
            try {
              if (this.state.focusResource !== focus) return false;
              const lensComponent = await lens.mediaContent({ mimeFallback: "text/vsx" });
              this.setState({ lensComponent });
              return undefined;
            } catch (error) {
              const finalError = wrapError(error,
                  `Exception caught in ${this.debugId()})\n .attachLens(), with:`,
                  "\n\tlens:", ...dumpObject(lens),
                  "\n\thead:", ...dumpObject(focus),
                  "\n\tuiContext:", this.state.uiContext,
                  "\n\tstate:", ...dumpObject(this.state),
                  "\n\tprops:", ...dumpObject(this.props),
              );
              outputError(finalError);
              this.enableError(finalError);
              return this._renderError(finalError);
            }
          } });
    }
  }

  renderProcessedUIComponent (focus: any) {
    // TODO(iridian): Fix this uggo hack where ui-context content is updated at render.
    if (this.props.hasOwnProperty("styleSheet")) {
      this.setUIContextValue(VSSStyleSheetSymbol, this.props.styleSheet);
    } else {
      this.clearUIContextValue(VSSStyleSheetSymbol);
    }

    const lens = this.tryRenderLensRole("lens");
    if (typeof lens !== "undefined") return lens;
    const fixedLens = this.tryRenderLensRole("fixedLens");
    if (typeof fixedLens !== "undefined") {
      console.error("DEPRECATED: props.fixedLens",
          "\n\tprefer: props.lens",
          "\n\tin component:", this.debugId(), this);
      return fixedLens;
    }

    if (focus === null) {
      return this.renderLensRole("nullLens");
    }

    if ((typeof focus !== "object") || React.isValidElement(focus)) {
      return this.renderLens(focus, "focus");
    }

    if (Array.isArray(focus)) {
      return this.renderSequence(focus);
    }

    if (Object.getPrototypeOf(focus) === Object.prototype) {
      return this.renderObjectAsValaaScope(focus);
    }

    if (!(focus instanceof Vrapper)) {
      throw new Error(`Unrecognized complex object of type '${
          (focus.constructor && focus.constructor.name) || "<constructor missing>"}' as UI focus`);
    }

    const activeLensComponent = this.tryRenderLensRole("activeLens");
    if (typeof activeLensComponent !== "undefined") return activeLensComponent;

    if (typeof this.state.lensComponent === "undefined") {
      return this.renderLensRole("downloadingLens");
    }
    return this.renderLens(this.state.lensComponent, "lensComponent");
  }

  renderSequence (sequence: any) {
    // focus comes from props, here.
    return sequence.map((focus, index) =>
        React.createElement(ValaaScope,
            this.childProps(`sequence[${index}]`, { focus },
                this.props.forEach ? { ...this.props.forEach } : {}),
            this.props.children));
  }

  renderObjectAsValaaScope (object: any) {
    return React.createElement(ValaaScope, this.childProps("noscope", object, { ...object }),
        this.props.children);
  }
}

export class ValaaNode extends ValaaScope {
  constructor (props: any, context: any) {
    super(props, context);
    console.error("DEPRECATED: ValaaNode\n\tprefer: ValaaScope");
  }
}

export function ValaaNodeDefault (props: Object) {
  console.error("DEPRECATED: JSXNodeDefault",
      "\n\tprefer: <ValaaScope activeLens={LENS`fallbackLens`} .../>");
  return <ValaaScope {...props} activeLens={LENS`fallbackLens`}>{props.children}</ ValaaScope>;
}

ValaaNodeDefault.isUIComponent = true;
ValaaNodeDefault.propTypes = ValaaScope.propTypes;
