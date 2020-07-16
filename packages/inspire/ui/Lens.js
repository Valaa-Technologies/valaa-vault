// @flow

import React from "react";

import { denoteValOSBuiltinWithSignature } from "~/raem/VALK";

import Vrapper from "~/engine/Vrapper";
import debugId from "~/engine/debugId";
import VALEK, { dumpObject } from "~/engine/VALEK";

import type UIComponent from "~/inspire/ui/UIComponent";

import { dumpify, messageFromError, thenChainEagerly, wrapError } from "~/tools";

type LensParameters = {
  tags: string[],
  type: string,
  description: string,
  isEnabled: ?boolean,
  lens: ?(boolean | (focus: any, component: UIComponent) => boolean | Symbol),
  defaultLens: any,
  isStickyError: ?boolean,
};

export const descriptorOptions: { [string]: () => LensParameters } = {};

export default _createLensObjects();

function _createLensObjects () {
  const ret = {};

  function _createSymbol (name: string, createLensParameters: Object) {
    descriptorOptions[name] = createLensParameters;
    ret[name] = Symbol(name);
    ret[ret[name]] = name;
    return ret[name];
  }

  const _lensMessageLoadingProps = {
    key: "lp",
    className: `inspire__lensMessage inspire__lensMessage_loading`,
  };
  const _lensMessageLoadingFailedProps = {
    key: "lfp",
    className: `inspire__lensMessage inspire__lensMessage_loadingFailed`,
  };
  const _lensMessageInternalFailureProps = {
    key: "ifp",
    className: `inspire__lensMessage inspire__lensMessage_internalFailure`,
  };
  const _element = "inspire__lensMessage-infoRow";
  const _message = { key: "msg", className: `${_element} ${_element}_message` };
  const _parameter = { key: "p0", className: `${_element} ${_element}_parameter` };
  const _lensChain = { key: "elc", className: `${_element} ${_element}_lensChain` };
  const _component = { key: "ec", className: `${_element} ${_element}_component` };
  const _key = { key: "i-k", className: `inspire__lensMessage-infoKey` };
  const _value = { key: "i-v", className: `inspire__lensMessage-infoValue` };

  ret.instrument = denoteValOSBuiltinWithSignature(
`function(subLens1[, subLens2[, ...[, subLensN]]])
Creates an _instrument lens_ which chains multiple sub-lenses in
sequence. When the instrument lens is used to view a focus it is first
set as the focus subLens1. The results shown by subLens1 is then set as
the focus of subLens2 and so on until the final results of the last
lens are shown as the output of the instrument lens itself.`
  // eslint-disable-next-line
  )(function instrument (...lenses) {
    return (focus: any, component: UIComponent, lensName: string) => {
      try {
        return lenses.reduce((refraction, lens) =>
            component.renderLens(lens, refraction, lensName, undefined, true), focus);
      } catch (error) {
        throw wrapError(error, `During ${component.debugId()}\n .instrument(), with:`,
            "\n\tlenses:", ...dumpObject(lenses),
            "\n\tfocus:", ...dumpObject(focus),
            "\n\tlensName:", lensName);
      }
    };
  });

  // Primary slots

  _createSymbol("focus", () => ({
    tags: ["Primary", "Attribute", "Lens"],
    type: "any",
    description:
`Attribute slot which contains the focused resource or value that is
viewed by the component. This is the value that most other lenses will
be inspecting.

Semantically the concept 'focus' corresponds to the model of the
model-view-controller design pattern. The concept 'lens' corresponds to
'view', and the various components roughly correspond to 'controller'.
`,
  }));

  _createSymbol("lens", () => ({
    tags: ["Primary", "Attribute", "Lens"],
    type: "Lens",
    description:
`Attribute slot for viewing the valid focus of a fully loaded component.

This slot can only be provided as a component attribute and is checked
only after focus and all other attributes are activated and only if the
focus is valid. The focus is valid if it is not a resource or if it is
an active Resource (ie. not unavailable or destroyed).

Semantically the concept 'lens' corresponds to the view of the
model-view-controller design pattern. The concept 'focus' corresponds
to 'model', and the various components roughly correspond to 'controller'.

    @focus {Object} focus  the focus of the component.`,
    isEnabled: true,
  }));

  // View control slots

  _createSymbol("array", () => ({
    tags: ["Attribute"],
    type: "any[] | null",
    description:
`Attribute slot which contains a focused sequence of values/resources
that should be viewed by duplicates of the component.

Once the focused array and all the attributes of the component are
activated and live tracked the component is duplicated in-place. One
duplicate component is created for each entry and the entry value is
set as the 'focus' attribute for the duplicate.

If there are no array entries then the component is removed.

If the attributes have any side-effects they are always evaluated once
per update irrespective of the array length (even if it is 0).
.`,
  }));

  _createSymbol("if", () => ({
    tags: ["Attribute", "Lens"],
    type: "any | (focus) => boolean",
    description:
`Attribute slot which contains a condition on whether to view the focus
using this component.

If the slot contains a callback it is called with 'focus' as the first
argument and the return value is used as the condition. Otherwise the
slot  value is used directly.

If the condition is truthy the focus is viewed with lens from slot
'then' (which by default renders the rest of the component normally).
If the condition is falsy the focus is viewed using lens from slot
'else' which presents null.
.`,
    isEnabled (focus: any, component: UIComponent) {
      let condition = component.props.if;
      if (condition === undefined) return false;
      if (component.props.then !== undefined) return true;
      if (typeof condition === "function") {
        condition = condition(focus);
      }
      return !condition; // if falsy condition, enable lens
    },
    lens (focus: any, component: UIComponent) {
      // if then is undefined we only get here if condition is falsy.
      const then_ = component.props.then;
      if (then_ !== undefined) {
        let condition = component.props.if;
        if (typeof condition === "function") condition = condition(focus);
        if (condition) return then_;
      }
      const else_ = component.props.else;
      return else_ === undefined ? [] : else_;
    },
  }));

  _createSymbol("then", () => ({
    tags: ["Attribute", "Lens"],
    type: "Lens",
    description:
`Attribute slot with which to view the focus after a truthy condition
check.

By default delegates viewing to the Valoscope lens chain.
`,
  }));

  _createSymbol("else", () => ({
    tags: ["Attribute", "Lens"],
    type: "Lens",
    description:
`Attribute slot with which to view the focus after a falsy condition
check.

By default displays null.
`,
  }));

  // Primitive lenses

  const slotAssembly = _createSymbol("slotAssembly", () => ({
    tags: ["Lens"],
    type: "string[]",
    description:
`Lens that shows the lens slot assembly that is used by the component.`,
  }));

  const niceActiveSlotNames = ret.instrument(
      slotAssembly,
      slotNames => slotNames.slice(0, -1).reverse().join(" <| "));

  const componentChildrenLens = _createSymbol("componentChildrenLens", () => ({
    tags: ["Lens"],
    type: "Lens",
    description:
`Lens that shows the child elements of the current parent component.`,
    isEnabled: (u: any, component: UIComponent) => {
      const children = component.props.children;
      return Array.isArray(children) ? children.length : children != null;
    },
    lens (focus: any, component: UIComponent) { return component.props.children; },
  }));

  const parentComponentLens = _createSymbol("parentComponentLens", () => ({
    tags: ["Lens"],
    type: "UIComponent",
    description:
`Lens that shows the current parent component. As the component itself
is not renderable this slot must be used in an instrument before some
other slot (such as 'focusDetailLens').`,
    isEnabled: true,
    lens (focus: any, component: UIComponent) { return component; },
  }));

  const focusDescriptionLens = _createSymbol("focusDescriptionLens", () => ({
    tags: ["Lens"],
    type: "Lens",
    description:
`Lens that shows an introspective description of the focus.

    @focus {any} focus  the focus to describe.`,
    isEnabled: true,
    lens: function renderFocusDescription (focus: any, component: UIComponent) {
      switch (typeof focus) {
        case "string":
          return `"${focus.length <= 30 ? focus : `${focus.slice(0, 27)}...`}"`;
        case "function":
          return `(${focus.name})`;
        case "object": {
          if (focus !== null) {
            if (focus instanceof Vrapper) return focus.debugId({ short: true });
            if (Array.isArray(focus)) {
              return `[${focus.map(entry => renderFocusDescription(entry, component))
                  .join(", ")}]`;
            }
            return `{ ${Object.keys(focus).join(", ")} }`;
          }
        }
        // eslint-disable-next-line no-fallthrough
        default:
          return JSON.stringify(focus);
      }
    },
  }));

  const focusDetailLens = _createSymbol("focusDetailLens", () => ({
    tags: ["Lens"],
    type: "Lens",
    description:
`Lens that shows a detailed, developer-oriented debug introspection of
the focus.

    @focus {any} focus  the focus to describe.`,
    isEnabled: true,
    lens: function renderFocusDetail (focus: any) {
      return debugId(focus);
    }
  }));

  const focusDumpLens = _createSymbol("focusDumpLens", () => ({
    tags: ["Lens"],
    type: "Lens",
    description:
`Lens that shows a full string dump of the focus.
Replaces circular/duplicates with tags.

    @focus {any} focus  the focus to dump.`,
    isEnabled: true,
    lens: function renderFocusDump (focus: any) {
      return dumpify(focus, { indent: 2 });
    },
  }));

  _createSymbol("focusPropertyKeysLens", () => ({
    tags: ["Lens"],
    type: "Lens",
    description:
`Lens that shows the list of property keys of the focused object or
resource (using Object.keys).

    @focus {object | Resource} focus  the focus to describe.`,
    isEnabled: (focus) => focus && (typeof focus === "object"),
    lens: function renderFocusPropertyKeys (focus: any) {
      return (!focus || (typeof focus !== "object")
          ? undefined
          : Object.keys(!(focus instanceof Vrapper) ? focus : focus.getValospaceScope()));
    },
  }));

  const toggleableErrorDetailLens = _createSymbol("toggleableErrorDetailLens", () => ({
    tags: ["Context", "Lens"],
    type: "Lens",
    description:
`A catch-all Slot for viewing a detailed, toggleable view of the
focused error.

The default lens on this slot renders Show and Hide buttons.

    @focus {string|Error} error  the failure description or exception object`,
    isEnabled: true,
    defaultLens: function renderToggleableErrorDetail (failure: any, component: UIComponent) {
      return ([
        <button onClick={() => component.toggleError()}>
          {component.state.errorHidden ? "Show" : "Hide"}
        </button>,
        <button onClick={() => component.clearError()}>
          Clear
        </button>,
        component.state.errorHidden ? null : (
          <pre style={{ fontFamily: "monospace" }}>
            {messageFromError(failure)}
          </pre>
        )
      ]);
    },
  }));

  _createSymbol("internalErrorLens", () => ({
    tags: ["Context", "Lens"],
    type: "Lens",
    description:
`A catch-all Slot for viewing the focused internal error, such as an
unhandled exception or a constraint violation like 'pendingLens'
resulting in a promise.
By default renders the yelling-red screen.

    @focus {string|Error} error  the failure description or exception object`,
    isEnabled: true,
    defaultLens: function renderInternalFailure () {
      return (
        <div {..._lensMessageInternalFailureProps}>
          Render Error: Component has internal error(s).
          {toggleableErrorDetailLens}
        </div>
      );
    },
  }));

  const currentRenderDepth = _createSymbol("currentRenderDepth", () => ({
    tags: ["Context", "Lens"],
    type: "number",
    description:
`Slot which contains the number of ancestor components that exist
between this component and the root (inclusive). If the value of this
slot is explicitly set it is used as the new base value for all nested
child components of this component.`,
    defaultLens: 0,
  }));

  _createSymbol("infiniteRecursionCheckWaterlineDepth", () => ({
    tags: ["Context", "Lens"],
    type: "number",
    description:
`Slot which contains the minimum currentRenderDepth for checking for
infinite render recursion.`,
    defaultLens: 150,
  }));

  const maximumRenderDepth = _createSymbol("maximumRenderDepth", () => ({
    tags: ["Context", "Lens"],
    type: "number",
    description:
`Slot which contains for the maximum allowed value for
currentRenderDepth.`,
    defaultLens: 200,
  }));

  const maximumRenderDepthExceededLens = _createSymbol("maximumRenderDepthExceededLens", () => ({
    tags: ["Context", "Lens"],
    type: "Lens",
    description:
`Slot for viewing the focus if the slot value of 'currentRenderDepth'
is greater than the slot value of 'maximumRenderDepth'.

    @focus {Object} focus  currently focused value.`,
    isEnabled: (u, component) =>
      (component.getUIContextValue(currentRenderDepth) >
          component.getUIContextValue(maximumRenderDepth)),
    defaultLens:
      <div {..._lensMessageInternalFailureProps}>
        <div {..._message}>
            Maximum render depth ({maximumRenderDepth}) exceeded.
        </div>
        <div {..._parameter}>
          <span {..._key}>currentRenderDepth:</span>
          <span {..._value}>{currentRenderDepth}</span>
        </div>
        <div key="p1" {..._parameter}>
          <span {..._key}>maximumRenderDepth:</span>
          <span {..._value}>{maximumRenderDepth}</span>
        </div>
        {commonMessageRows}
      </div>,
  }));

  // User-definable catch-all lenses

  const loadingLens = _createSymbol("loadingLens", () => ({
    tags: ["Attribute", "Context", "Lens"],
    type: "Lens",
    description:
`A catch-all slot for viewing a description of a dependency which is
still being loaded.

This slot has no default lens.
Place a lens to this slot to have all the *default* implementations of
all other loading -like slots be delegated to it instead of using their
own default lens.

    @focus {Object} component  an object description of the dependency being loaded`,
  }));

  const loadingFailedLens = _createSymbol("loadingFailedLens", () => ({
    tags: ["Attribute", "Context", "Lens"],
    type: "Lens",
    description:
`A catch-all slot for viewing a description of a dependency which has
failed to load.

This slot has no default lens.
Place a lens to this slot to have all the *default* implementations of
all other loading-failed -like slots be delegated to it instead of
using their own default lens.

    @focus {string|Error|Object} reason  the explanation of the loading failure`,
  }));


  // Main component lifecycle lens

  _createSymbol("valoscopeLens", () => ({
    tags: ["Internal", "Lens"],
    type: "Lens",
    description:
`Internal lens for showing the focus via the Valoscope lens slot
sequence.

Valoscope is a built-in fabric component which searches the first
enabled lens in the particular sequence of slots (which is defined
below) based on the current dynamic state and/or value of the focus.

    @focus {any} focus  the focus of the component`,
    isEnabled: true,
    lens: ({ delegate: Object.freeze([
      ret.firstEnabledDelegateLens,
      ret.if,
      ret.disabledLens,
      ret.unframedLens,
      maximumRenderDepthExceededLens,
      ret.instanceLens,
      ret.undefinedLens,
      ret.lens,
      ret.nullLens,
      componentChildrenLens,
      ret.resourceLens,
      ret.loadedLens,
    ]) }),
  }));

  _createSymbol("valensLens", () => ({
    tags: ["Internal", "Lens"],
    type: "Lens",
    description:
`Internal lens for viewing the focus via the Valens lens slot sequence.

Valens is a built-in fabric component which wraps a UI component
and subscribes to sourcerer event updates that affect the props of that
component. It then triggers the dynamic update of the wrapped UI
component in response to such events.

    @focus {any} focus  the focus of the component`,
    isEnabled: true,
    lens: ({ delegate: Object.freeze([
      ret.firstEnabledDelegateLens,
      ret.disabledLens,
      ret.undefinedLens,
      ret.loadedLens,
    ]) }),
  }));

  _createSymbol("uiComponentLens", () => ({
    tags: ["Internal", "Lens"],
    type: "Lens",
    description:
`Internal lens for viewing the focus via the UIComponent lens slot
sequence.

UIComponent is a built-in fabric component base class which is
responsible for connecting the lens system into the underlying React
implementation.

    @focus {string|Error|Object} focus  the focus of the component`,
    isEnabled: true,
    lens: ({ delegate: [
      ret.firstEnabledDelegateLens,
      ret.disabledLens,
      ret.undefinedLens,
      ret.loadedLens,
    ] }),
  }));


  _createSymbol("firstEnabledDelegateLens", () => ({
    tags: ["Internal", "Lens"],
    type: "Lens",
    description:
`Internal lens for viewing the focus via the first enabled lens listed
in the $Lens.delegate of the current fabric component.

    @focus {string|Error|Object} focus  the focus of the component`,
    isEnabled: (u, component) => (component.props.delegate !== undefined),
    lens: function renderFirstEnabledDelegate (focus, component, lensName = "delegate") {
      return component.renderFirstEnabledDelegate(component.props.delegate, focus, lensName);
    }
  }));

  _createSymbol("loadedLens", () => ({
    tags: ["Internal", "Lens"],
    type: "Lens",
    description:
`Internal lens for viewing the focus by calling the .renderLoaded
fabric method of the current component.

    @focus {string|Error|Object} focus  the focus of the component`,
    isEnabled: true,
    lens: function renderLoaded (focus, component) {
      return component.renderLoaded(focus);
    },
  }));

  // Content lenses

  _createSymbol("undefinedLens", () => ({
    tags: ["Attribute", "Context", "Lens"],
    type: "Lens",
    description:
`Slot for viewing an undefined focus.`,
    isEnabled: (focus) => (focus === undefined),
    defaultLens: ({ delegate: [
      ret.instrument(
          (u, component) => (component.props.focus),
          ret.pendingFocusLens),
    ] }),
  }));

  _createSymbol("nullLens", () => ({
    tags: ["Attribute", "Context", "Lens"],
    type: "Lens",
    description:
`Slot for viewing a null focus.`,
    isEnabled: (focus) => (focus === null),
    defaultLens: "",
  }));

  _createSymbol("resourceLens", () => ({
    tags: ["Attribute", "Context", "Lens"],
    type: "Lens",
    description:
`Slot for viewing the focused Resource based on its activation phase.

The default lens delegates the viewing to a lens slot based on whether
the focus is is inactive, activating, active, destroyer or unavailable.

Note: This lens slot will initiate the activation of the focus!

    @focus {Resource} focus  the Resource focus.`,
    // TODO(iridian, 2019-03): Is this actually correct? Semantically
    // activating the lens inside isEnabled is fishy.
    // Maybe this was intended to be refreshPhase instead?
    isEnabled: (focus?: Vrapper) => (focus instanceof Vrapper) && focus.activate(),
    defaultLens: ({ delegate: [
      ret.activeLens,
      ret.activatingLens,
      ret.inactiveLens,
      ret.destroyedLens,
      ret.unavailableLens,
    ] }),
  }));

  _createSymbol("activeLens", () => ({
    tags: ["Attribute", "Context", "Lens"],
    type: "Lens",
    description:
`Slot for viewing an active focused Resource.

The default lens delegates showing to focusPropertyLens.

    @focus {Object} focus  the active Resource focus.`,
    isEnabled: (focus?: Vrapper) => focus && focus.isActive(),
    defaultLens: ret.focusPropertyLens,
  }));

  _createSymbol("lensProperty", () => ({
    tags: ["Attribute", "Context"],
    type: "(string | string[])",
    description:
`Slot which contains the property name (or an array of names) that is
looked up from a focused Resource in order to view that Resource itself.
This slot is used by all lens property lenses as the default fallback
property name.`,
  }));

  _createLensPropertySlots("focusLensProperty", ["FOCUS_LENS"],
      "focusPropertyLens", "lensPropertyNotFoundLens");
  _createLensPropertySlots("delegateLensProperty", ["DELEGATE_LENS"],
      "delegatePropertyLens", "notLensResourceLens");

  function _createLensPropertySlots (specificLensPropertySlotName, defaultLensProperties,
      propertyLensName, notFoundName) {
    const slotSymbol = _createSymbol(specificLensPropertySlotName, () => ({
      tags: ["Attribute", "Context"],
      type: "(string | string[])",
      description:
`Slot which contains the property name that is searched from the
Resource focus when resolving the *${propertyLensName}* lens. Can be an
array of property names in which case they are searched in order and
the first property with not-undefined value is selected.`,
      isEnabled: undefined,
      defaultLens: defaultLensProperties,
    }));

    _createSymbol(propertyLensName, () => ({
      tags: ["Internal", "Lens"],
      type: "Lens",
      description:
`Internal slot for viewing the focused Resource via a *property lens*
read from the focus Resource itself. By default searches the focused
Resource for a specific lens property named in slot '${specificLensPropertySlotName}'.

If no specific lens property is found then the generic lens property
name which is defined in slot 'lensProperty' is searched.

If a property name slot contains an array of strings then these are
searched in the order they are defined from the focus Resource.

If still no suitable lens can be found delegates the viewing to '${notFoundName || "null"}'.

    @focus {Object} focus  the Resource to search the lens from.`,
      isEnabled: (focus?: Vrapper) => focus && focus.hasInterface("Scope"),
      lens: function propertyLensNameGetter (focus: any, component: UIComponent,
          /* currentSlotName: string */) {
        /*
        if (component.props.lensName) {
          console.warn("DEPRECATED: props.lensName\n\tprefer: props.lensProperty",
              "\n\tlensName:", JSON.stringify(component.props.lensName),
              "\n\tin component:", component.debugId(), component);
        }
        */
        const scope = focus.tryValospaceScope();
        const options = { scope };
        const specificNames = component.props[specificLensPropertySlotName]
            || component.getUIContextValue(slotSymbol);
        const specificLensValue = specificNames ? _lookupPropertyBy(specificNames) : undefined;
        if (specificLensValue !== undefined) return specificLensValue;

        const genericNames = component.props.lensProperty
            || component.getUIContextValue(ret.lensProperty);
        const genericLensValue = genericNames ? _lookupPropertyBy(genericNames) : undefined;
        if (genericLensValue !== undefined) return genericLensValue;
        /*
        console.error("Can't find resource lens props:", specificLensPropertySlotName, slotSymbol,
            "\n\tnotFoundName:", notFoundName, ret[notFoundName],
            "\n\tcomponent:", component,
            "\n\tfocus:", focus);
        */

        if (!notFoundName) return null;
        return { delegate: [ret[notFoundName]] };

        function _lookupPropertyBy (propertyNames) {
          if (!Array.isArray(propertyNames)) {
            return (scope && scope.hasOwnProperty(propertyNames))
                ? scope[propertyNames] : _stepForProperty(focus, propertyNames, options);
          }
          for (const name of propertyNames) {
            const vProperty = (scope && scope.hasOwnProperty(name))
                ? scope[name] : _stepForProperty(focus, name, options);
            if (vProperty !== undefined) return vProperty;
          }
          return undefined;
        }
      },
    }));
  }

  const _propertyKueries = {};
  function _stepForProperty (focus, propertyName, options) {
    const kuery = _propertyKueries[propertyName]
        || (_propertyKueries[propertyName] = VALEK.property(propertyName));
    return focus.step(kuery, options);
  }

  // Valoscope

  _createSymbol("scopeChildren", () => ({
    tags: ["Internal", "Lens"],
    type: "any",
    description:
`Lens for viewing the focus using the child element(s) of the innermost
enclosing Valoscope component.

Depending on the exact location of the reference to this slot inside
some media there are three notably different looking use cases.

1. When this lens is used as an attribute slot value of some valoscope
  element then this lens refers to the direct child elements of that
  valoscope as they are specified in the same lens media.
2. When this lens is used as an element inside a lens media without any
  enclosing valoscope elements then this lens refers to the child
  elements of the external valoscope which is using the lens media.
3. When this lens is used as an element inside a lens media which does
  have an enclosing valoscope element then just like in case one this
  lens refers to the child elements of that element.
  This easily results in strange recursion and should be avoided.
`
  }));

  // Instance lenses

  _createSymbol("unframedLens", () => ({
    tags: ["Attribute", "Context", "Lens"],
    type: "Lens",
    description:
`Slot for viewing a Valoscope which has not yet loaded its lens frame.`,
    isEnabled: (focus, component) => !component.state || (component.state.scopeFrame === undefined),
    defaultLens: function renderUnframed () {
      return "<Loading frame...>";
    },
  }));

  _createSymbol("instanceLens", () => ({
    tags: ["Internal", "Lens"],
    type: "Lens",
    description:
`Internal slot for viewing the focus through an instance Valoscope (ie.
one which has the attribute 'instanceLensPrototype' defined).

Awaits for the scopeFrame promise to resolve and then searches the
the focus for instance lens property and if found delegates the viewing
to it. If no instance lens property is found from the focus then
delegates the viewing to the lens(es) specified by the scopeFrame
instance prototype.
`,
    isEnabled: (focus, component) => component.props.instanceLensPrototype,
    lens: function renderInstance (focus, component, currentSlotName) {
      return thenChainEagerly(
          component.state.scopeFrame, [
            (scopeFrame => {
              if ((scopeFrame == null) || !(scopeFrame instanceof Vrapper)) return "";
              if (!scopeFrame.hasInterface("Scope")) return scopeFrame;
              const instanceSlotName = `instance-${currentSlotName}`;
              const instanceLens = component.getUIContextValue(ret.instancePropertyLens)(
                  scopeFrame, component, instanceSlotName);
              return (instanceLens != null) ? instanceLens : scopeFrame;
            }),
          ]);
    },
  }));

  _createLensPropertySlots("instanceLensProperty", ["INSTANCE_LENS"], "instancePropertyLens",
      "mediaInstanceLens");

  _createSymbol("mediaInstanceLens", () => ({
    tags: ["Internal", "Lens"],
    type: "Lens",
    description:
`Internal slot for viewing an instance lens of a Media which doesn't
specify a lens property at all.

    @focus {Object} focus  the active Resource focus.`,
    isEnabled: (focus, component) =>
        (component.props.instanceLensPrototype.getTypeName() === "Media"),
    lens: function renderMediaInstance (focus, component) {
      return component.props.instanceLensPrototype;
    },
  }));

  _createSymbol("scopeFrameResource", () => ({
    tags: ["Internal", "Context"],
    type: "Resource",
    description:
`Slot which contains the current innermost enclosing scope frame that
is also a Resource. Any scope frames that are created by the child
components of the current component will use this scope frame resource
as their owner.`,
  }));

  _createSymbol("lensAuthorityProperty", () => ({
    tags: ["Context"],
    type: "(string)",
    description:
`Slot which contains the property name that is used when searching a
resource for an authority URI string.

This property will be searched for from a lens instance prototype or
a Resource focus when obtaining a lens frame.
If found the authority URI will be used for the lens chronicle.
If the chronicle didn't already exist new lens chronicle is created in
that authority URI with a new scope frame resource as its chronicle
root.`,
    isEnabled: undefined,
    defaultLens: "LENS_AUTHORITY",
  }));

  _createSymbol("shadowLensChronicleRoot", () => ({
    tags: ["Internal", "Context"],
    type: "(Resource | null)",
    description:
`Slot which contains the resource that is the root resource of the
current shadow lens chronicle.

A shadow lens chronicle is the chronicle which was created to contain
lens frames for a particular focus resource. This focused resource is
stored in slot 'shadowedFocus'.`,
  }));

  _createSymbol("shadowedFocus", () => ({
    tags: ["Internal", "Context"],
    type: "(Resource | null)",
    description:
`Slot which contains a resource that is currently shadowed by a shadow
lens chronicle (the root resource of this chronicle is stored in slot
'shadowLensChronicleRoot'). This slot is used to detect if a particular
focus is already being shadowed in which case no new shadow chronicle
will be created.`,
  }));

  _createSymbol("shadowLensAuthority", () => ({
    tags: ["Internal", "Context"],
    type: "(string | null)",
    description:
`Slot which contains the default lens authority URI for those scope
frames which have a chronicle root Resource as their focus. Used when a
lens authority is not explicitly provided via property stored
'lensAuthorityProperty' of the instance or of the focus.`,
    isEnabled: undefined,
    defaultLens: "valaa-memory:",
  }));

  _createSymbol("integrationScopeResource", () => ({
    tags: ["Context"],
    type: "Resource",
    description:
`Slot which contains the integration scope resource of the innermost
Media that is used as source for render elements.`,
  }));

  // Main component lens sequence and failure lenses

  const commonMessageRows = [
    <div {..._lensChain}>
      <span {..._key}>Lens slot delegation:</span>
      <span {..._value}>{niceActiveSlotNames}</span>
    </div>,
    <div {..._component}>
      <span {..._key}>Containing component:</span>
      <span {..._value}>
        {ret.instrument(parentComponentLens, focusDetailLens)}
      </span>
    </div>,
  ];

  _createSymbol("disabledLens", () => ({
    tags: ["Internal", "Context", "Lens"],
    type: "Lens",
    description:
`Slot for viewing an explicitly disabled component.

    @focus {string|Error|Object} reason  a description of why the component is disabled.`,
    isEnabled: (u, component) => ((component.state || {}).uiContext === undefined),
    defaultLens: ({ delegate: [
      loadingFailedLens,
      <div {..._lensMessageLoadingFailedProps}>
        <div {..._message}>Component is disabled; focus and context are not available.</div>
        <div {..._parameter}>
          <span {..._key}>Disable reason:</span>
          <span {..._value}>{focusDetailLens}</span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  _createSymbol("pendingLens", () => ({
    tags: ["Attribute", "Context", "Lens"],
    type: "Lens",
    description:
`Slot for viewing a description of a generic dependency which is a
pending promise. If the lens placed to this slot returns a promise then
'internalErrorLens' is displayed instead.

    @focus {Object} dependency  a description object of the pending dependency.`,
    isEnabled: true,
    defaultLens: ({ delegate: [
      loadingLens,
      <div {..._lensMessageLoadingProps}>
        <div {..._message}>Waiting for a pending dependency Promise to resolve.</div>
        <div {..._parameter}>
          <span {..._key}>Dependency:</span>
          <span {..._value}>{focusDetailLens}</span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  _createSymbol("failedLens", () => ({
    tags: ["Attribute", "Context", "Lens"],
    type: "Lens",
    description:
`Slot for viewing a generic lens Promise failure.

    @focus {string|Error|Object} reason  a description of why the lens Promise failed.`,
    isEnabled: true,
    defaultLens: ({ delegate: [
      loadingFailedLens,
      <div {..._lensMessageInternalFailureProps}>
        <div {..._message}>
          Render Error: Lens Promise failed.
          {toggleableErrorDetailLens}
        </div>
        <div {..._parameter}>
          <span {..._key}>Lens:</span>
          <span {..._value}>
            {ret.instrument(error => error.lens, focusDetailLens)}
          </span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  _createSymbol("pendingConnectionsLens", () => ({
    tags: ["Attribute", "Context", "Lens"],
    type: "Lens",
    description:
`Slot for viewing a description of chronicle connection(s) that are
being acquired.

    @focus {Object[]} connections  the chronicle connection(s) that are being acquired.`,
    isEnabled: true,
    defaultLens: ({ delegate: [
      loadingLens,
      <div {..._lensMessageLoadingProps}>
        <div {..._message}>Acquiring chronicle connection(s).</div>
        <div {..._parameter}>
          <span {..._key}>Chronicles:</span>
          <span {..._value}>{focusDescriptionLens}</span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  _createSymbol("failedConnectionsLens", () => ({
    tags: ["Attribute", "Context", "Lens"],
    type: "Lens",
    description:
`Slot for viewing chronicle connection failure(s).

    @focus {string|Error|Object} reason  a description of why the connection failed.`,
    isEnabled: true,
    defaultLens: ({ delegate: [
      loadingFailedLens,
      <div {..._lensMessageInternalFailureProps}>
        <div {..._message}>
          Render Error: Optimistic Chronicle connection failed.
          {toggleableErrorDetailLens}
        </div>
        <div {..._parameter}>
          <span {..._key}>Chronicle:</span>
          <span {..._value}>
            {ret.instrument(error => error.resource, focusDescriptionLens)}
          </span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  _createSymbol("pendingActivationLens", () => ({
    tags: ["Attribute", "Context", "Lens"],
    type: "Lens",
    description:
`Slot for viewing a description of the focused resource that is pending
activation.

    @focus {Object[]} resource  the resource that is being activated.`,
    isEnabled: true,
    defaultLens: ({ delegate: [
      loadingLens,
      <div {..._lensMessageLoadingProps}>
        <div {..._message}>Activating resource.</div>
        <div {..._parameter}>
          <span {..._key}>Resource:</span>
          <span {..._value}>{focusDescriptionLens}</span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  _createSymbol("failedActivationLens", () => ({
    tags: ["Attribute", "Context", "Lens"],
    type: "Lens",
    description:
`Slot for viewing resource activation failure(s).

    @focus {string|Error|Object} reason  a description of why the resource activation failed.`,
    isEnabled: true,
    defaultLens: ({ delegate: [
      loadingFailedLens,
      <div {..._lensMessageInternalFailureProps}>
        <div {..._message}>
          Render Error: Resource activation failed.
          {toggleableErrorDetailLens}
        </div>
        <div {..._parameter}>
          <span {..._key}>Resource:</span>
          <span {..._value}>
            {ret.instrument(error => error.resource, focusDescriptionLens)}
          </span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  _createSymbol("inactiveLens", () => ({
    tags: ["Attribute", "Context", "Lens"],
    type: "Lens",
    description:
`Slot for viewing a focused inactive Resource.

    @focus {Object} focus  the inactive Resource focus.`,
    isEnabled: (focus?: Vrapper) => focus && focus.isInactive(),
    defaultLens: ({ delegate: [
      loadingFailedLens,
      <div {..._lensMessageLoadingFailedProps}>
        <div {..._message}>Focus {focusDescriptionLens} is inactive.</div>
        <div {..._parameter}>
          <span {..._key}>Focus resource info:</span>
          <span {..._value}>{focusDetailLens}</span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  _createSymbol("pendingMediaInterpretationLens", () => ({
    tags: ["Attribute", "Context", "Lens"],
    type: "Lens",
    description:
`Slot for viewing a description of a focused Media which is being
interpreted (ie. downloaded, decoded and integrated).

    @focus {Media} media  the Media being interpreted.`,
    isEnabled: true,
    defaultLens: ({ delegate: [
      loadingLens,
      <div {..._lensMessageLoadingProps}>
        <div {..._message}>Downloading dependency {focusDetailLens}.</div>
        <div {..._parameter}>
          <span {..._key}>Of Media:</span>
          <span {..._value}>{focusDetailLens}</span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  _createSymbol("failedMediaInterpretationLens", () => ({
    tags: ["Attribute", "Context", "Lens"],
    type: "Lens",
    description:
`Slot for viewing the focused failure on why a particular media
interpretation could not be rendered.

    @focus {string|Error|Object} reason  interpretation render failure reason.`,
    isEnabled: true,
    defaultLens: ({ delegate: [
      loadingFailedLens,
      <div {..._lensMessageLoadingFailedProps}>
        <div {..._message}>
          Render Error: Failed to render Media interpretation.
          {toggleableErrorDetailLens}
        </div>
        <div {..._parameter}>
          <span {..._key}>Of Media:</span>
          <span {..._value}>
            {ret.instrument(error => error.media, focusDescriptionLens)}
          </span>
        </div>
        <div key="p1" {..._parameter}>
          <span {..._key}>Interpretation info:</span>
          <span {..._value}>
            {ret.instrument(error => error.mediaInfo, ret.focusDetail)}
          </span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  _createSymbol("unrenderableMediaInterpretationLens", () => ({
    tags: ["Attribute", "Context", "Lens"],
    type: "Lens",
    description:
`Slot for viewing a focused media with an interpretation that cannot or
should not be rendered (such as octet stream, complex native object or
an undefined value).

    @focus {string|Error|Object} reason  interpretation render failure reason.`,
    isEnabled: true,
    defaultLens: ret.failedMediaInterpretationLens,
  }));

  _createSymbol("mediaInterpretationErrorLens", () => ({
    tags: ["Attribute", "Context", "Lens"],
    type: "Lens",
    description:
`Slot for viewing a focused error that was encountered during media
interpretation.

    @focus {string|Error|Object} reason  interpretation error.`,
    isEnabled: true,
    defaultLens: ret.failedMediaInterpretationLens,
  }));

  _createSymbol("pendingFocusLens", () => ({
    tags: ["Context", "Lens"],
    type: "Lens",
    description:
`Slot for viewing a component with an unfinished focus kuery.

    @focus {Object} focus  the focus kuery.`,
    isEnabled: (focus) => (focus === undefined),
    defaultLens: ({ delegate: [
      loadingLens,
      <div {..._lensMessageLoadingProps}>
        <div {..._message}>Waiting for focus kuery to complete.</div>
        <div {..._parameter}>
          <span {..._key}>Focus:</span>
          <span {..._value}>{focusDetailLens}</span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  _createSymbol("kueryingPropsLens", () => ({
    tags: ["Context", "Lens"],
    type: "Lens",
    description:
`Slot for viewing a description of one or more unfinished props kueries.

    @focus {Object} props  the unfinished props kueries.`,
    isEnabled: true,
    defaultLens: ({ delegate: [
      loadingLens,
      <div {..._lensMessageLoadingProps}>
        <div {..._message}>Waiting for props kueries to complete.</div>
        <div {..._parameter}>
          <span {..._key}>Props kueries:</span>
          <span {..._value}>{focusDetailLens}</span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  _createSymbol("pendingPropsLens", () => ({
    tags: ["Context", "Lens"],
    type: "Lens",
    description:
`Slot for viewing the description of props which are pending Promises.

    @focus {Object} props  the pending props Promises.`,
    isEnabled: true,
    defaultLens: ({ delegate: [
      loadingLens,
      <div {..._lensMessageLoadingProps}>
        <div {..._message}>Waiting for pending props Promise(s) to resolve.</div>
        <div {..._parameter}>
          <span {..._key}>Props promises:</span>
          <span {..._value}>{focusDetailLens}</span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  _createSymbol("failedPropsLens", () => ({
    tags: ["Context", "Lens"],
    type: "Lens",
    description:
`Slot for viewing a props Promise failure.

    @focus {string|Error|Object} reason  props Promise failure reason.`,
    isEnabled: true,
    // TODO(iridian, 2019-02): Limit the props names to only the failing props.
    defaultLens: ({ delegate: [
      loadingFailedLens,
      <div {..._lensMessageInternalFailureProps}>
        <div {..._message}>
          Render Error: props Promise failure.
          {toggleableErrorDetailLens}
        </div>
        <div {..._parameter}>
          <span {..._key}>Props (all) names:</span>
          <span {..._value}>
            {ret.instrument(error => error.propsNames, focusDetailLens)}
          </span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  _createSymbol("pendingChildrenLens", () => ({
    tags: ["Attribute", "Context", "Lens"],
    type: "Lens",
    description:
`Slot for viewing a description of pending children Promise.

    @focus {Object} children  the pending children Promise.`,
    isEnabled: true,
    defaultLens: ({ delegate: [
      loadingLens,
      <div {..._lensMessageLoadingProps}>
        <div {..._message}>  Waiting for a pending children Promise to resolve.</div>
        <div {..._parameter}>
          <span {..._key}>Children:</span>
          <span {..._value}>{focusDetailLens}</span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  _createSymbol("failedChildrenLens", () => ({
    tags: ["Attribute", "Context", "Lens"],
    type: "Lens",
    description:
`Slot for viewing a child Promise failure.

    @focus {string|Error|Object} reason  child Promise failure reason.`,
    isEnabled: true,
    // TODO(iridian, 2019-02): Add a grand-child path description to the errors.
    defaultLens: ({ delegate: [
      loadingFailedLens,
      <div {..._lensMessageInternalFailureProps}>
        <div {..._message}>
          Render Error: Child Promise failure.
          {toggleableErrorDetailLens}
        </div>
        <div {..._parameter}>
          <span {..._key}>Children:</span>
          <span {..._value}>
            {ret.instrument(error => error.children, focusDetailLens)}
          </span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  _createSymbol("activatingLens", () => ({
    tags: ["Attribute", "Context", "Lens"],
    type: "Lens",
    description:
`Slot for viewing an activating Resource.

    @focus {Object} focus  the activating Resource focus.`,
    isEnabled: (focus?: Vrapper) => focus && focus.isActivating(),
    defaultLens: ({ delegate: [
      (focus, component) => {
        const activation = focus.activate();
        if (activation !== focus) activation.then(() => component.forceUpdate());
        return undefined;
      },
      loadingLens,
      <div {..._lensMessageLoadingProps}>
        <div {..._message}>Activating focus {focusDescriptionLens}.</div>
        <div {..._parameter}>
          <span {..._key}>Focus resource info:</span>
          <span {..._value}>{focusDetailLens}</span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  _createSymbol("inactiveLens", () => ({
    tags: ["Attribute", "Context", "Lens"],
    type: "Lens",
    description:
`Slot for viewing an inactive Resource.

    @focus {Object} focus  the inactive Resource focus.`,
    isEnabled: (focus?: Vrapper) => focus && focus.isInactive(),
    defaultLens: ({ delegate: [
      loadingFailedLens,
      <div {..._lensMessageLoadingFailedProps}>
        <div {..._message}>Focus {focusDescriptionLens} is inactive.</div>
        <div {..._parameter}>
          <span {..._key}>Focus resource info:</span>
          <span {..._value}>{focusDetailLens}</span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  _createSymbol("unavailableLens", () => ({
    tags: ["Attribute", "Context", "Lens"],
    type: "Lens",
    description:
`Slot for viewing an unavailable Resource.

    @focus {Object} focus  the unavailable Resource focus.`,
    isEnabled: (focus?: Vrapper) => focus && focus.isUnavailable(),
    defaultLens: ({ delegate: [
      loadingFailedLens,
      <div {..._lensMessageLoadingFailedProps}>
        <div {..._message}>Focus {focusDescriptionLens} is unavailable.</div>
        <div {..._parameter}>
          <span {..._key}>Focus resource info:</span>
          <span {..._value}>{focusDetailLens}</span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  _createSymbol("destroyedLens", () => ({
    tags: ["Attribute", "Context", "Lens"],
    type: "Lens",
    description:
`Slot for viewing a destroyed Resource.

    @focus {Object} focus  the destroyed Resource focus.`,
    isEnabled: (focus?: Vrapper) => focus && (focus.isImmaterial() && !focus.isGhost()),
    defaultLens: ({ delegate: [
      loadingFailedLens,
      <div {..._lensMessageLoadingFailedProps}>
        <div {..._message}>Focus {focusDescriptionLens} has been destroyed.</div>
        <div {..._parameter}>
          <span {..._key}>Focus resource info:</span>
          <span {..._value}>{focusDetailLens}</span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  _createSymbol("lensPropertyNotFoundLens", () => ({
    tags: ["Attribute", "Context", "Lens"],
    type: "Lens",
    description:
`Slot for viewing a description of an active Resource focus which does
not have a requested lens property.

    @focus {Object} focus  the active Resource focus.`,
    isEnabled: true,
    defaultLens: ({ delegate: [
      loadingFailedLens,
      <div {..._lensMessageLoadingFailedProps}>
        <div {..._message}>
          Cannot find a lens property from the active focus {focusDescriptionLens}.
        </div>
        <div>
          <span {..._message}>Slots which add lens property names to be searched:</span>
          <div {..._parameter}>
            <span {..._key}>focusLensProperty:</span>
            <span {..._value}>
              {ret.instrument(ret.focusLensProperty, p => JSON.stringify(p))}
            </span>
          </div>
          <div key="p1" {..._parameter}>
            <span {..._key}>lensProperty:</span>
            <span {..._value}>
              {ret.instrument(ret.lensProperty, p => JSON.stringify(p))}
            </span>
          </div>
        </div>
        <div>
          <span {..._message}>Focus that was searched for the lens property:</span>
          <div {..._parameter}>
            <span {..._key}>detail:</span>
            <span {..._value}>{focusDetailLens}</span>
          </div>
          <div key="p1" {..._parameter}>
            <span {..._key}>has properties:</span>
            <span {..._value}>
              {ret.instrument(ret.focusPropertyKeysLens, p => JSON.stringify(p))}
            </span>
          </div>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  _createSymbol("notLensResourceLens", () => ({
    tags: ["Context", "Lens"],
    type: "Lens",
    description:
`Slot for viewing a Resource which cannot be used as a lens.

    @focus {Object} nonLensResource  the non-lens-able Resource.`,
    isEnabled: true,
    defaultLens: ({ delegate: [
      loadingFailedLens,
      <div {..._lensMessageLoadingFailedProps}>
        <div {..._message}>
          Resource {focusDescriptionLens} cannot be used as a lens.
          This is because it is not a valid lens Media file nor does it
          have a lens property that is listed in either
          %27delegateLensProperty%27 or %27lensProperty%27 slots.
        </div>
        <div>
          <span {..._message}>Slots which add lens property names to be searched:</span>
          <div {..._parameter}>
            <span {..._key}>delegateLensProperty:</span>
            <span {..._value}>
              {ret.instrument(ret.delegateLensProperty, p => JSON.stringify(p))}
            </span>
          </div>
          <div key="p1" {..._parameter}>
            <span {..._key}>lensProperty:</span>
            <span {..._value}>
              {ret.instrument(ret.lensProperty, p => JSON.stringify(p))}
            </span>
          </div>
        </div>
        <div>
          <span {..._message}>Resource that was searched for the lens property:</span>
          <div {..._parameter}>
            <span {..._key}>Lens candidate detail:</span>
            <span {..._value}>{focusDetailLens}</span>
          </div>
          <div key="p1" {..._parameter}>
            <span {..._key}>Lens candidate has properties:</span>
            <span {..._value}>
              {ret.instrument(ret.focusPropertyKeysLens, p => JSON.stringify(p))}
            </span>
          </div>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  _createSymbol("arrayNotIterableLens", () => ({
    tags: ["Context", "Lens"],
    type: "Lens",
    description:
`Slot for viewing a valoscope $Lens.array which is not an iterable.

    @focus {Object} nonArray  the non-iterable value.`,
    isEnabled: true,
    defaultLens: ({ delegate: [
      loadingFailedLens,
      <div {..._lensMessageLoadingFailedProps}>
        <div {..._message}>props.array {focusDescriptionLens} is not an iterable.</div>
        <div {..._parameter}>
          <span {..._key}>props.array:</span>
          <span {..._value}>{focusDetailLens}</span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  _createSymbol("invalidElementLens", () => ({
    tags: ["Context", "Lens"],
    type: "Lens",
    description:
`Slot for viewing an a description of an invalid UI element.

    @focus {Object} description  string or object description.`,
    isEnabled: true,
    defaultLens: ({ delegate: [
      loadingFailedLens,
      <div {..._lensMessageLoadingFailedProps}>
        <div {..._message}>
            {ret.instrument(parentComponentLens, focusDetailLens)}
            returned an invalid element.
        </div>
        <div {..._parameter}>
          <span {..._key}>Faults:</span>
          <span {..._value}>{focusDumpLens}</span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));
  return ret;
}
