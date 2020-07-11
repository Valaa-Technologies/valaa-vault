// @flow

import React from "react";

import { denoteValOSBuiltinWithSignature } from "~/raem/VALK";

import Vrapper from "~/engine/Vrapper";
import debugId from "~/engine/debugId";
import VALEK, { dumpObject } from "~/engine/VALEK";

import type UIComponent from "~/inspire/ui/UIComponent";

import { arrayFromAny, dumpify, messageFromError, thenChainEagerly, wrapError } from "~/tools";

type LensParameters = {
  type: string,
  description: string,
  isEnabled: ?(boolean | (focus: any, component: UIComponent) => boolean),
  rootValue: any,
  isStickyError: ?boolean,
};

export const descriptorOptions: { [string]: () => LensParameters } = {};

export default _createLensObjects();

function _createLensObjects () {
  const ret = {};

  function createSlotSymbol (name: string, createLensParameters: Object) {
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

  // Primitive lenses

  const slotAssembly = createSlotSymbol("slotAssembly", () => ({
    type: "string[]",
    description:
`Slot which contains the lens slot assembly that is used by the component.`,
  }));

  const niceActiveSlotNames = ret.instrument(
      slotAssembly,
      slotNames => slotNames.slice(0, -1).reverse().join(" <| "));

  const componentChildrenLens = createSlotSymbol("componentChildrenLens", () => ({
    type: "Lens",
    description:
`Slot for viewing the child elements of the current parent component.`,
    isEnabled: (u: any, component: UIComponent) => arrayFromAny(component.props.children).length,
    rootValue: function renderComponentChildren (u: any, component: UIComponent) {
      return component.props.children;
    },
  }));

  const parentComponentLens = createSlotSymbol("parentComponentLens", () => ({
    type: "() => UIComponent",
    description:
`Slot for accessing the current parent component. As the component
itself is not renderable this slot must be used in an instrument before
some other slot (such as 'focusDetailLens').`,
    isEnabled: true,
    rootValue: function renderParentComponent (f: any, component: UIComponent) {
      return component;
    },
  }));

  const focusDescriptionLens = createSlotSymbol("focusDescriptionLens", () => ({
    type: "Lens",
    description:
`Slot for viewing a description of the focus.

    @focus {any} focus  the focus to describe.`,
    isEnabled: true,
    rootValue: function renderFocusDescription (focus: any, component: UIComponent) {
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

  const focusDetailLens = createSlotSymbol("focusDetailLens", () => ({
    type: "Lens",
    description:
`Slot for viewing a developer-oriented debug introspection of the focus.

    @focus {any} focus  the focus to describe.`,
    isEnabled: true,
    rootValue: function renderFocusDetail (focus: any) {
      return debugId(focus);
    }
  }));

  const focusDumpLens = createSlotSymbol("focusDumpLens", () => ({
    type: "Lens",
    description:
`Slot for viewing a full string dump of the focus.
Replaces circular/duplicates with tags.

    @focus {any} focus  the focus to dump.`,
    isEnabled: true,
    rootValue: function renderFocusDump (focus: any) {
      return dumpify(focus, { indent: 2 });
    },
  }));

  createSlotSymbol("focusPropertyKeysLens", () => ({
    type: "Lens",
    description:
`Slot for viewing the list of property keys of the focused object or
resource (using Object.keys).

    @focus {object | Resource} focus  the focus to describe.`,
    isEnabled: (focus) => focus && (typeof focus === "object"),
    rootValue: function renderFocusPropertyKeys (focus: any) {
      return (!focus || (typeof focus !== "object")
          ? undefined
          : Object.keys(!(focus instanceof Vrapper) ? focus : focus.getValospaceScope()));
    },
  }));

  const toggleableErrorDetailLens = createSlotSymbol("toggleableErrorDetailLens", () => ({
    type: "Lens",
    description:
`A catch-all Slot for viewing a detailed, toggleable view of the
focused error.

    @focus {string|Error} error  the failure description or exception object`,
    isEnabled: true,
    rootValue: function renderToggleableErrorDetail (failure: any, component: UIComponent) {
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

  createSlotSymbol("internalErrorLens", () => ({
    type: "Lens",
    description:
`A catch-all Slot for viewing the focused internal error, such as an
unhandled exception or a constraint violation like 'pendingLens'
resulting in a promise.
By default renders the yelling-red screen.

    @focus {string|Error} error  the failure description or exception object`,
    isEnabled: true,
    rootValue: function renderInternalFailure () {
      return (
        <div {..._lensMessageInternalFailureProps}>
          Render Error: Component has internal error(s).
          {toggleableErrorDetailLens}
        </div>
      );
    },
  }));

  const currentRenderDepth = createSlotSymbol("currentRenderDepth", () => ({
    type: "number",
    description:
`Slot which contains the number of ancestor components that exist
between this component and the root (inclusive). If the value of this
slot is explicitly set it is used as the new base value for all nested
child components of this component.`,
    rootValue: 0,
  }));

  createSlotSymbol("infiniteRecursionCheckWaterlineDepth", () => ({
    type: "number",
    description:
`Slot which contains the minimum currentRenderDepth for checking for
infinite render recursion.`,
    rootValue: 150,
  }));

  const maximumRenderDepth = createSlotSymbol("maximumRenderDepth", () => ({
    type: "number",
    description:
`Slot which contains for the maximum allowed value for
currentRenderDepth.`,
    rootValue: 200,
  }));

  const maximumRenderDepthExceededLens = createSlotSymbol("maximumRenderDepthExceededLens", () => ({
    type: "Lens",
    description:
`Slot for viewing the focus if the slot value of 'currentRenderDepth'
is greater than the slot value of 'maximumRenderDepth'.

    @focus {Object} focus  currently focused value.`,
    isEnabled: (u, component) =>
      (component.getUIContextValue(currentRenderDepth) >
          component.getUIContextValue(maximumRenderDepth)),
    rootValue:
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

  const loadingLens = createSlotSymbol("loadingLens", () => ({
    type: "Lens",
    description:
`A catch-all slot for viewing a description of a dependency which is
still being loaded.

Undefined by default; assign a lens to this slot to have all the
*default* implementations of all other loading -like slots be delegated
to it instead of using their own default lens.

    @focus {Object} component  an object description of the dependency being loaded`,
  }));

  const loadingFailedLens = createSlotSymbol("loadingFailedLens", () => ({
    type: "Lens",
    description:
`A catch-all slot for viewing a description of a dependency which has
failed to load.

Undefined by default; place a lens to this slot to have all
the *default* implementations of all other loading-failed -like
slots be delegated to it instead of using their own default lens.

    @focus {string|Error|Object} reason  the explanation of the loading failure`,
  }));


  // Main component lifecycle lens

  createSlotSymbol("valoscopeLens", () => ({
    type: "Lens",
    description:
`Slot for viewing the focus via the Valoscope lens slot sequence.
Valoscope is a built-in fabric component which searches the first
enabled lens in the particular sequence of slots (which is defined
below) based on the current dynamic state and/or value of the focus.

    @focus {any} focus  the focus of the component`,
    isEnabled: true,
    rootValue: ({ delegate: Object.freeze([
      ret.firstEnabledDelegateLens,
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

  createSlotSymbol("livePropsLens", () => ({
    type: "Lens",
    description:
`Slot for viewing the focus via the LiveProps lens slot sequence.
LiveProps is a built-in fabric component which wraps a UI component
and subscribes to sourcerer event updates that affect the props of that
component. It then triggers the dynamic update of the wrapped UI
component in response to such events.

    @focus {any} focus  the focus of the component`,
    isEnabled: true,
    rootValue: ({ delegate: Object.freeze([
      ret.firstEnabledDelegateLens,
      ret.disabledLens,
      ret.undefinedLens,
      ret.loadedLens,
    ]) }),
  }));

  createSlotSymbol("uiComponentLens", () => ({
    type: "Lens",
    description:
`Slot for viewing the focus via the UIComponent lens slot sequence.
UIComponent is a built-in fabric component base class which is
responsible for connecting the lens system into the underlying React
implementation.

    @focus {string|Error|Object} focus  the focus of the component`,
    isEnabled: true,
    rootValue: ({ delegate: [
      ret.firstEnabledDelegateLens,
      ret.disabledLens,
      ret.undefinedLens,
      ret.loadedLens,
    ] }),
  }));


  createSlotSymbol("firstEnabledDelegateLens", () => ({
    type: "Lens",
    description:
`Slot for viewing the focus via the first enabled lens listed in the
props.delegate of the current fabric component.

    @focus {string|Error|Object} focus  the focus of the component`,
    isEnabled: (u, component) => (component.props.delegate !== undefined),
    rootValue: function renderFirstEnabledDelegate (focus, component, lensName = "delegate") {
      return component.renderFirstEnabledDelegate(component.props.delegate, focus, lensName);
    }
  }));

  createSlotSymbol("loadedLens", () => ({
    type: "Lens",
    description:
`Slot for viewing the focus via the .renderLoaded fabric method of the
current component.

    @focus {string|Error|Object} focus  the focus of the component`,
    isEnabled: true,
    rootValue: function renderLoaded (focus, component) {
      return component.renderLoaded(focus);
    },
  }));

  // Content lenses

  createSlotSymbol("undefinedLens", () => ({
    type: "Lens",
    description:
`Slot for viewing an undefined focus.`,
    isEnabled: (focus) => (focus === undefined),
    rootValue: ({ delegate: [
      ret.instrument(
          (u, component) => (component.props.focus),
          ret.pendingFocusLens),
    ] }),
  }));

  createSlotSymbol("nullLens", () => ({
    type: "Lens",
    description:
`Slot for viewing a null focus.`,
    isEnabled: (focus) => (focus === null),
    rootValue: "",
  }));

  createSlotSymbol("lens", () => ({
    type: "Lens",
    description:
`Slot for viewing the focus of a fully loaded component.

This slow is undefined by default. If a lens is placed into this slot
it is rendered after focus and all props are loaded and activated but
only if the focus is valid. The focus is valid if it is not a resource
or if it is an active Resource (not unavailable or destroyed).

    @focus {Object} focus  the focus of the component.`,
    isEnabled: true,
    rootValue: undefined,
  }));

  createSlotSymbol("resourceLens", () => ({
    type: "Lens",
    description:
`Slot for viewing the focused Resource based on its activation phase.
Delegates the viewing to a lens slot based on whether the focus is is
inactive, activating, active, destroyer or unavailable.

Note: This lens slot will initiate the activation of the focus!

    @focus {Resource} focus  the Resource focus.`,
    // TODO(iridian, 2019-03): Is this actually correct? Semantically
    // activating the lens inside isEnabled is fishy.
    // Maybe this was intended to be refreshPhase instead?
    isEnabled: (focus?: Vrapper) => (focus instanceof Vrapper) && focus.activate(),
    rootValue: ({ delegate: [
      ret.activeLens,
      ret.activatingLens,
      ret.inactiveLens,
      ret.destroyedLens,
      ret.unavailableLens,
    ] }),
  }));

  createSlotSymbol("activeLens", () => ({
    type: "Lens",
    description:
`Slot for viewing an active focused Resource.

    @focus {Object} focus  the active Resource focus.`,
    isEnabled: (focus?: Vrapper) => focus && focus.isActive(),
    rootValue: ret.focusPropertyLens,
  }));

  createSlotSymbol("lensProperty", () => ({
    type: "(string | string[])",
    description:
`Slot which contains the property name (or array of names) that is
retrieved from a Resource to be used a property lens. This slot is used
by all lens property lenses as the default fallback property name.`,
  }));

  _createLensPropertySlots("focusLensProperty", ["FOCUS_LENS"],
      "focusPropertyLens", "lensPropertyNotFoundLens");
  _createLensPropertySlots("delegateLensProperty", ["DELEGATE_LENS"],
      "delegatePropertyLens", "notLensResourceLens");

  function _createLensPropertySlots (specificLensPropertySlotName, defaultLensProperties,
      propertyLensName, notFoundName) {
    const slotSymbol = createSlotSymbol(specificLensPropertySlotName, () => ({
      type: "(string | string[])",
      description:
`Slot which contains the property name that is searched from the
Resource focus when resolving the *${propertyLensName}* lens. Can be an
array of property names in which case they are searched in order and
the first property with not-undefined value is selected.`,
      isEnabled: undefined,
      rootValue: defaultLensProperties,
    }));

    createSlotSymbol(propertyLensName, () => ({
      type: "Lens",
      description:
`Slot for viewing the focused Resource via a *property lens* read from
the focus Resource itself. By default searches the focused Resource for
a property with the name specified in slot '${specificLensPropertySlotName}'.

If no lens property is found then props.lensProperty and
context[valos.Lens.lensProperty] are searched.
The props/context property name can also be an array, in which
case the first matching lens is returned.

If still no suitable lens can be found delegates the viewing to '${notFoundName || "null"}'.

    @focus {Object} focus  the Resource to search the lens from.`,
      isEnabled: (focus?: Vrapper) => focus && focus.hasInterface("Scope"),
      rootValue: function propertyLensNameGetter (focus: any, component: UIComponent,
          /* currentSlotName: string */) {
        /*
        if (component.props.lensName) {
          console.warn("DEPRECATED: props.lensName\n\tprefer: props.lensProperty",
              "\n\tlensName:", JSON.stringify(component.props.lensName),
              "\n\tin component:", component.debugId(), component);
        }
        */
        const scope = focus.tryValospaceScope();
        const specificLensValue = _tryAndBindPropertyLiveKuery(
            component.props[specificLensPropertySlotName]
                || component.getUIContextValue(slotSymbol)
                // || component.context[specificLensPropertySlotName]
        );
        if (specificLensValue !== undefined) return specificLensValue;

        // const legacyLensNameValue = _tryAndBindPropertyLiveKuery(component.props.lensName);
        // if (legacyLensNameValue !== undefined) return legacyLensNameValue;

        const genericLensValue = _tryAndBindPropertyLiveKuery(
            component.props.lensProperty
                  || component.getUIContextValue(ret.lensProperty)
                  // || component.context.lensProperty
        );
        if (genericLensValue !== undefined) return genericLensValue;
        /*
        console.error("Can't find resource lens props:", specificLensPropertySlotName, slotSymbol,
            "\n\tnotFoundName:", notFoundName, ret[notFoundName],
            "\n\tcomponent:", component,
            "\n\tfocus:", focus);
        */

        if (!notFoundName) return null;
        return { delegate: [ret[notFoundName]] };

        function _tryAndBindPropertyLiveKuery (propertyName) {
          if (!propertyName) return undefined;
          if (Array.isArray(propertyName)) {
            for (const name of propertyName) {
              const vProperty = (scope && scope.hasOwnProperty(name))
                  ? scope[name]
                  : focus.step(VALEK.property(propertyName));
              if (vProperty !== undefined) return vProperty;
            }
            return undefined;
          }
          return (scope && scope.hasOwnProperty(propertyName))
              ? scope[propertyName]
              : focus.step(VALEK.property(propertyName));
        }
      },
    }));
  }

  // Valoscope lenses

  createSlotSymbol("scopeChildren", () => ({
    type: "any",
    description:
`The child element(s) of the innermost enclosing Valoscope-like parent
component.`,
  }));

  // Instance lenses

  createSlotSymbol("unframedLens", () => ({
    type: "Lens",
    description:
`Slot for viewing a Valoscope which has not yet loaded its lens frame.`,
    isEnabled: (focus, component) => !component.state || (component.state.scopeFrame === undefined),
    rootValue: function renderUnframed () {
      return "<Loading frame...>";
    },
  }));

  createSlotSymbol("instanceLens", () => ({
    type: "Lens",
    description:
`Slot for viewing the focus through an instance lens (ie a Valoscope
which has instanceLensPrototype defined).`,
    isEnabled: (focus, component) => component.props.instanceLensPrototype,
    rootValue: function renderInstance (focus, component, currentSlotName) {
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

  createSlotSymbol("mediaInstanceLens", () => ({
    type: "Lens",
    description:
`Slot for viewing an instance lens of a Media which doesn't have the
INSTANCE_LENS property.

    @focus {Object} focus  the active Resource focus.`,
    isEnabled: (focus, component) =>
        (component.props.instanceLensPrototype.getTypeName() === "Media"),
    rootValue: function renderMediaInstance (focus, component) {
      return component.props.instanceLensPrototype;
    },
  }));

  createSlotSymbol("scopeFrameResource", () => ({
    type: "Resource",
    description:
`Slot which contains the current innermost enclosing scope frame which
is also a Resource. Used as the owner for any scope frames created for
any of its child components.`,
  }));

  createSlotSymbol("integrationScopeResource", () => ({
    type: "Resource",
    description:
`Slot which contains the integration scope resource of the innermost
Media that is used a source for render elements.`,
  }));

  createSlotSymbol("static", () => ({
    type: "(true | undefined)",
    description:
`Attribute which disables live kueries for other non-namespaced
attributes. Namespaced attributes are always live.`,
  }));

  createSlotSymbol("scopeFrameResource", () => ({
    type: "Resource",
    description:
`Slot which contains the current innermost enclosing scope frame which
is also a Resource. Used as the owner for any scope frames created for
any of its child components.`,
  }));

  createSlotSymbol("lensAuthorityProperty", () => ({
    type: "(string)",
    description:
`Slot which contains the property name that is used when searching for
an authority URI string.

This property will be searched for from a lens instance prototype or
a Resource focus when obtaining a lens frame.
If found the authority URI will be used for the lens chronicle.
If the chronicle didn't already exist new lens chronicle is created in
that authority URI with a new scope frame resource as its chronicle
root.`,
    isEnabled: undefined,
    rootValue: "LENS_AUTHORITY",
  }));

  createSlotSymbol("shadowLensChronicleRoot", () => ({
    type: "(Resource | null)",
    description:
`Slot which contains the resource that is the root resource of the
current shadow lens chronicle.

A shadow lens chronicle is the chronicle which was created to contain
lens frames for a particular focus resource. This focused resource is
stored in slot 'shadowedFocus'.`,
  }));

  createSlotSymbol("shadowedFocus", () => ({
    type: "(Resource | null)",
    description:
`Slot which contains a resource that is currently shadowed by a shadow
lens chronicle (the root resource of this chronicle is stored in slot
'shadowLensChronicleRoot'). This slot is used to detect if a particular
focus is already being shadowed in which case no new shadow chronicle
will be created.`,
  }));

  createSlotSymbol("shadowLensAuthority", () => ({
    type: "(string | null)",
    description:
`Slot which contains the default lens authority URI for those scope
frames which have a chronicle root Resource as their focus. Used when a
lens authority is not explicitly provided via property stored
'lensAuthorityProperty' of the instance or of the focus.`,
    isEnabled: undefined,
    rootValue: "valaa-memory:",
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

  createSlotSymbol("disabledLens", () => ({
    type: "Lens",
    description:
`Slot for viewing an explicitly disabled component.

    @focus {string|Error|Object} reason  a description of why the component is disabled.`,
    isEnabled: (u, component) => ((component.state || {}).uiContext === undefined),
    rootValue: ({ delegate: [
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

  createSlotSymbol("pendingLens", () => ({
    type: "Lens",
    description:
`Slot for viewing a description of a generic dependency which is a
pending promise. If the lens placed to this slot returns a promise then
'internalErrorLens' is displayed instead.

    @focus {Object} dependency  a description object of the pending dependency.`,
    isEnabled: true,
    rootValue: ({ delegate: [
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

  createSlotSymbol("failedLens", () => ({
    type: "Lens",
    description:
`Slot for viewing a generic lens Promise failure.

    @focus {string|Error|Object} reason  a description of why the lens Promise failed.`,
    isEnabled: true,
    rootValue: ({ delegate: [
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

  createSlotSymbol("pendingConnectionsLens", () => ({
    type: "Lens",
    description:
`Slot for viewing a description of chronicle connection(s) that are
being acquired.

    @focus {Object[]} connections  the chronicle connection(s) that are being acquired.`,
    isEnabled: true,
    rootValue: ({ delegate: [
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

  createSlotSymbol("failedConnectionsLens", () => ({
    type: "Lens",
    description:
`Slot for viewing chronicle connection failure(s).

    @focus {string|Error|Object} reason  a description of why the connection failed.`,
    isEnabled: true,
    rootValue: ({ delegate: [
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

  createSlotSymbol("pendingActivationLens", () => ({
    type: "Lens",
    description:
`Slot for viewing a description of the focused resource that is pending
activation.

    @focus {Object[]} resource  the resource that is being activated.`,
    isEnabled: true,
    rootValue: ({ delegate: [
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

  createSlotSymbol("failedActivationLens", () => ({
    type: "Lens",
    description:
`Slot for viewing resource activation failure(s).

    @focus {string|Error|Object} reason  a description of why the resource activation failed.`,
    isEnabled: true,
    rootValue: ({ delegate: [
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

  createSlotSymbol("inactiveLens", () => ({
    type: "Lens",
    description:
`Slot for viewing a focused inactive Resource.

    @focus {Object} focus  the inactive Resource focus.`,
    isEnabled: (focus?: Vrapper) => focus && focus.isInactive(),
    rootValue: ({ delegate: [
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

  createSlotSymbol("downloadingLens", () => ({
    type: "Lens",
    description:
`Slot for viewing a description of a focused Media whose content is
being downloaded.

    @focus {Media} media  the Media being downloaded.`,
    isEnabled: true,
    rootValue: ({ delegate: [
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

  createSlotSymbol("pendingMediaInterpretationLens", () => ({
    type: "Lens",
    description:
`Slot for viewing a description of a focused Media which is being
interpreted (ie. downloaded, decoded and integrated).

    @focus {Media} media  the Media being interpreted.`,
    isEnabled: true,
    rootValue: ({ delegate: [
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

  createSlotSymbol("failedMediaInterpretationLens", () => ({
    type: "Lens",
    description:
`Slot for viewing the focused failure on why a particular media
interpretation could not be rendered.

    @focus {string|Error|Object} reason  interpretation render failure reason.`,
    isEnabled: true,
    rootValue: ({ delegate: [
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

  createSlotSymbol("unrenderableMediaInterpretationLens", () => ({
    type: "Lens",
    description:
`Slot for viewing a focused media with an interpretation that cannot or
should not be rendered (such as octet stream, complex native object or
an undefined value).

    @focus {string|Error|Object} reason  interpretation render failure reason.`,
    isEnabled: true,
    rootValue: ret.failedMediaInterpretationLens,
  }));

  createSlotSymbol("mediaInterpretationErrorLens", () => ({
    type: "Lens",
    description:
`Slot for viewing a focused error that was encountered during media
interpretation.

    @focus {string|Error|Object} reason  interpretation error.`,
    isEnabled: true,
    rootValue: ret.failedMediaInterpretationLens,
  }));

  createSlotSymbol("pendingFocusLens", () => ({
    type: "Lens",
    description:
`Slot for viewing a component with an unfinished focus kuery.

    @focus {Object} focus  the focus kuery.`,
    isEnabled: (focus) => (focus === undefined),
    rootValue: ({ delegate: [
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

  createSlotSymbol("kueryingPropsLens", () => ({
    type: "Lens",
    description:
`Slot for viewing a description of one or more unfinished props kueries.

    @focus {Object} props  the unfinished props kueries.`,
    isEnabled: true,
    rootValue: ({ delegate: [
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

  createSlotSymbol("pendingPropsLens", () => ({
    type: "Lens",
    description:
`Slot for viewing the description of props which are pending Promises.

    @focus {Object} props  the pending props Promises.`,
    isEnabled: true,
    rootValue: ({ delegate: [
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

  createSlotSymbol("failedPropsLens", () => ({
    type: "Lens",
    description:
`Slot for viewing a props Promise failure.

    @focus {string|Error|Object} reason  props Promise failure reason.`,
    isEnabled: true,
    // TODO(iridian, 2019-02): Limit the props names to only the failing props.
    rootValue: ({ delegate: [
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

  createSlotSymbol("pendingChildrenLens", () => ({
    type: "Lens",
    description:
`Slot for viewing a description of pending children Promise.

    @focus {Object} children  the pending children Promise.`,
    isEnabled: true,
    rootValue: ({ delegate: [
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

  createSlotSymbol("failedChildrenLens", () => ({
    type: "Lens",
    description:
`Slot for viewing a child Promise failure.

    @focus {string|Error|Object} reason  child Promise failure reason.`,
    isEnabled: true,
    // TODO(iridian, 2019-02): Add a grand-child path description to the errors.
    rootValue: ({ delegate: [
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

  createSlotSymbol("activatingLens", () => ({
    type: "Lens",
    description:
`Slot for viewing an activating Resource.

    @focus {Object} focus  the activating Resource focus.`,
    isEnabled: (focus?: Vrapper) => focus && focus.isActivating(),
    rootValue: ({ delegate: [
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

  createSlotSymbol("inactiveLens", () => ({
    type: "Lens",
    description:
`Slot for viewing an inactive Resource.

    @focus {Object} focus  the inactive Resource focus.`,
    isEnabled: (focus?: Vrapper) => focus && focus.isInactive(),
    rootValue: ({ delegate: [
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

  createSlotSymbol("unavailableLens", () => ({
    type: "Lens",
    description:
`Slot for viewing an unavailable Resource.

    @focus {Object} focus  the unavailable Resource focus.`,
    isEnabled: (focus?: Vrapper) => focus && focus.isUnavailable(),
    rootValue: ({ delegate: [
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

  createSlotSymbol("destroyedLens", () => ({
    type: "Lens",
    description:
`Slot for viewing a destroyed Resource.

    @focus {Object} focus  the destroyed Resource focus.`,
    isEnabled: (focus?: Vrapper) => focus && (focus.isImmaterial() && !focus.isGhost()),
    rootValue: ({ delegate: [
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

  createSlotSymbol("lensPropertyNotFoundLens", () => ({
    type: "Lens",
    description:
`Slot for viewing a description of an active Resource focus which does
not have a requested lens property.

    @focus {Object} focus  the active Resource focus.`,
    isEnabled: true,
    rootValue: ({ delegate: [
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

  createSlotSymbol("notLensResourceLens", () => ({
    type: "Lens",
    description:
`Slot for viewing a Resource which cannot be used as a lens.

    @focus {Object} nonLensResource  the non-lens-able Resource.`,
    isEnabled: true,
    rootValue: ({ delegate: [
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

  createSlotSymbol("arrayNotIterableLens", () => ({
    type: "Lens",
    description:
`Slot for viewing a valoscope props.array which is not an iterable.

    @focus {Object} nonArray  the non-iterable value.`,
    isEnabled: true,
    rootValue: ({ delegate: [
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

  createSlotSymbol("invalidElementLens", () => ({
    type: "Lens",
    description:
`Slot for viewing an a description of an invalid UI element.

    @focus {Object} description  string or object description.`,
    isEnabled: true,
    rootValue: ({ delegate: [
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
