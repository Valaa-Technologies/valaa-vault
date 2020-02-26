// @flow

import React from "react";

import { denoteValOSBuiltinWithSignature } from "~/raem/VALK";
import { naiveURI } from "~/raem/ValaaURI";
import derivedId from "~/raem/tools/derivedId";

import type { Connection } from "~/sourcerer";

import Vrapper from "~/engine/Vrapper";
import debugId from "~/engine/debugId";
import VALEK, { dumpObject } from "~/engine/VALEK";

import UIComponent from "~/inspire/ui/UIComponent";

import { arrayFromAny, dumpify, messageFromError, thenChainEagerly, wrapError } from "~/tools";

type LensParameters = {
  type: string,
  description: string,
  isEnabled: ?(boolean | (focus: any, component: UIComponent) => boolean),
  rootValue: any,
  isStickyError: ?boolean,
};

export default function injectLensObjects (valos: Object, rootScope: Object,
    hostDescriptors: Object) {
  valos.Lens = {};
  const lensDescriptorOptions: { [string]: () => LensParameters } = {};

  function createSlotSymbol (name: string, createLensParameters: Object) {
    lensDescriptorOptions[name] = createLensParameters;
    valos.Lens[name] = Symbol(name);
    valos.Lens[valos.Lens[name]] = name;
    return valos.Lens[name];
  }

  function finalizeLensDescriptors () {
    const lensDescriptors = {};
    Object.entries(lensDescriptorOptions).forEach(
        ([slotName, createLensParameters]) => {
          const { value, type, description, isEnabled, rootValue } = createLensParameters();
          const descriptor = {
            valos: true, symbol: true,
            value, type, description,
            writable: false, enumerable: true, configurable: false,
          };
          if (isEnabled !== undefined) {
            Object.assign(descriptor, { slotName: true, isEnabled });
          }
          lensDescriptors[slotName] = Object.freeze(descriptor);
          hostDescriptors.set(valos.Lens[slotName], descriptor);
          if (rootValue) rootScope[valos.Lens[slotName]] = Object.freeze(rootValue);
        });
    hostDescriptors.set(valos.Lens, lensDescriptors);
  }

  const _lensMessageLoadingProps = {
    className: `inspire__lensMessage inspire__lensMessage_loading`,
  };
  const _lensMessageLoadingFailedProps = {
    className: `inspire__lensMessage inspire__lensMessage_loadingFailed`,
  };
  const _lensMessageInternalFailureProps = {
    className: `inspire__lensMessage inspire__lensMessage_internalFailure`,
  };
  const _element = "inspire__lensMessage-infoRow";
  const _message = { className: `${_element} ${_element}_message` };
  const _parameter = { className: `${_element} ${_element}_parameter` };
  const _lensChain = { className: `${_element} ${_element}_lensChain` };
  const _component = { className: `${_element} ${_element}_component` };
  const _key = { className: `inspire__lensMessage-infoKey` };
  const _value = { className: `inspire__lensMessage-infoValue` };

  valos.Lens.instrument = denoteValOSBuiltinWithSignature(
      `function(subLens1[, subLens2[, ...[, subLensN]]])
      Creates an _instrument lens_ which chains multiple sub-lenses in
      sequence. When the instrument lens is used to view a focus it is
      first set as the focus subLens1. The results shown by subLens1
      is then set as the focus of subLens2 and so on until the final
      results of the last lens are shown as the output of the
      instrument lens itself.`
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
    description: `Slot which contains the lens slot assembly that is used by the component.`,
  }));

  const niceActiveSlotNames = valos.Lens.instrument(
      slotAssembly,
      slotNames => slotNames.slice(0, -1).reverse().join(" <| "));

  const componentChildrenLens = createSlotSymbol("componentChildrenLens", () => ({
    type: "Lens",
    description: `Slot for viewing the child elements of the
        current parent component.`,
    isEnabled: (u: any, component: UIComponent) => arrayFromAny(component.props.children).length,
    rootValue: function renderComponentChildren (u: any, component: UIComponent) {
      return component.props.children;
    },
  }));

  const parentComponentLens = createSlotSymbol("parentComponentLens", () => ({
    type: "() => UIComponent",
    description: `Slot for accessing the current parent component.
        As the component itself is not renderable this slot must be
        used in an instrument before some other slot (such as
        'focusDetailLens').`,
    isEnabled: true,
    rootValue: function renderParentComponent (f: any, component: UIComponent) {
      return component;
    },
  }));

  const focusDescriptionLens = createSlotSymbol("focusDescriptionLens", () => ({
    type: "Lens",
    description: `Slot for viewing a description of the focus.

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
    description: `Slot for viewing a developer-oriented debug
        introspection of the focus.

        @focus {any} focus  the focus to describe.`,
    isEnabled: true,
    rootValue: function renderFocusDetail (focus: any) {
      return debugId(focus);
    }
  }));

  const focusDumpLens = createSlotSymbol("focusDumpLens", () => ({
    type: "Lens",
    description: `Slot for viewing a full string dump of the focus.
        Replaces circular/duplicates with tags.

        @focus {any} focus  the focus to dump.`,
    isEnabled: true,
    rootValue: function renderFocusDump (focus: any) {
      return dumpify(focus, { indent: 2 });
    },
  }));

  createSlotSymbol("focusPropertyKeysLens", () => ({
    type: "Lens",
    description: `Slot for viewing the list of property keys of
        the focused object or resource (using Object.keys).

        @focus {object | Resource} focus  the focus to describe.`,
    isEnabled: (focus) => focus && (typeof focus === "object"),
    rootValue: function renderFocusPropertyKeys (focus: any) {
      return (!focus || (typeof focus !== "object")
          ? undefined
          : Object.keys(!(focus instanceof Vrapper) ? focus : focus.getLexicalScope()));
    },
  }));

  const toggleableErrorDetailLens = createSlotSymbol("toggleableErrorDetailLens", () => ({
    type: "Lens",
    description: `A catch-all Slot for viewing a detailed,
        toggleable view of the focused error.

        @focus {string|Error} error  the failure description or exception object`,
    isEnabled: true,
    rootValue: function renderToggleableErrorDetail (failure: any, component: UIComponent) {
      return ([
        <button onClick={component.toggleError}>
          {component.state.errorHidden ? "Show" : "Hide"}
        </button>,
        <button onClick={component.clearError}>
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
    description: `A catch-all Slot for viewing the focused
        internal error, such as an unhandled exception or a constraint
        violation like 'pendingLens' resulting in a promise.
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
    description: `Slot which contains the number of ancestor components
        that exist between this component and the root (inclusive). If
        the value of this slot is explicitly set it is used as the new
        base value for all nested child components of this component.`,
    rootValue: 0,
  }));

  const maximumRenderDepth = createSlotSymbol("maximumRenderDepth", () => ({
    type: "number",
    description: `Slot which contains for the maximum allowed value for
        currentRenderDepth.`,
    rootValue: 200,
  }));

  const maximumRenderDepthExceededLens = createSlotSymbol("maximumRenderDepthExceededLens", () => ({
    type: "Lens",
    description: `Slot for viewing the focus if the slot value of
        'currentRenderDepth' is greater than the slot value of
        'maximumRenderDepth'.

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
        <div {..._parameter}>
          <span {..._key}>maximumRenderDepth:</span>
          <span {..._value}>{maximumRenderDepth}</span>
        </div>
        {commonMessageRows}
      </div>,
  }));

  // User-definable catch-all lenses

  const loadingLens = createSlotSymbol("loadingLens", () => ({
    type: "Lens",
    description: `A catch-all slot for viewing a description of a
        dependency which is still being loaded.
        Undefined by default; place a lens to this slot to have all
        the *default* implementations of all other loading -like slots
        be delegated to it instead of using their own default lens.

        @focus {Object} component  an object description of the dependency being loaded`,
  }));

  const loadingFailedLens = createSlotSymbol("loadingFailedLens", () => ({
    type: "Lens",
    description: `A catch-all slot for viewing a description of a
        dependency which has failed to load.
        Undefined by default; place a lens to this slot to have all
        the *default* implementations of all other loading-failed -like
        slots be delegated to it instead of using their own default lens.

        @focus {string|Error|Object} reason  the explanation of the loading failure`,
  }));


  // Main component lifecycle lens

  createSlotSymbol("valoscopeLens", () => ({
    type: "Lens",
    description: `Slot for viewing the focus via the Valoscope
        lens slot sequence. Valoscope is an internal fabric component
        which searches the first enabled lens in the particular
        sequence of slots (which is defined below) based on the current
        dynamic state and/or value of the focus.

        @focus {any} focus  the focus of the component`,
    isEnabled: true,
    rootValue: ({ delegate: Object.freeze([
      valos.Lens.firstEnabledDelegateLens,
      valos.Lens.disabledLens,
      valos.Lens.unframedLens,
      maximumRenderDepthExceededLens,
      valos.Lens.instanceLens,
      valos.Lens.undefinedLens,
      valos.Lens.lens,
      valos.Lens.nullLens,
      componentChildrenLens,
      valos.Lens.resourceLens,
      valos.Lens.loadedLens,
    ]) }),
  }));

  createSlotSymbol("livePropsLens", () => ({
    type: "Lens",
    description: `Slot for viewing the focus via the LiveProps lens
        slot sequence. LiveProps is an internal fabric component which
        wraps a UI component subscribes to sourcerer event updates that
        affect the props of that component. It then triggers the
        dynamic update of the wrapped UI component in response to
        such events.

        @focus {any} focus  the focus of the component`,
    isEnabled: true,
    rootValue: ({ delegate: Object.freeze([
      valos.Lens.firstEnabledDelegateLens,
      valos.Lens.disabledLens,
      valos.Lens.undefinedLens,
      valos.Lens.loadedLens,
    ]) }),
  }));

  createSlotSymbol("uiComponentLens", () => ({
    type: "Lens",
    description: `Slot for viewing the focus via the UIComponent lens
        slot sequence. UIComponent is an internal fabric component base
        class and responsible for connecting the lens system into
        the React implementation.

        @focus {string|Error|Object} focus  the focus of the component`,
    isEnabled: true,
    rootValue: ({ delegate: [
      valos.Lens.firstEnabledDelegateLens,
      valos.Lens.disabledLens,
      valos.Lens.undefinedLens,
      valos.Lens.loadedLens,
    ] }),
  }));


  createSlotSymbol("firstEnabledDelegateLens", () => ({
    type: "Lens",
    description: `Slot for viewing the focus via the first enabled
        lens listed in the props.delegate of the current fabric
        component.

        @focus {string|Error|Object} focus  the focus of the component`,
    isEnabled: (u, component) => (component.props.delegate !== undefined),
    rootValue: function renderFirstEnabledDelegate (focus, component, lensName = "delegate") {
      return component.renderFirstEnabledDelegate(component.props.delegate, focus, lensName);
    }
  }));

  createSlotSymbol("loadedLens", () => ({
    type: "Lens",
    description: `Slot for viewing the focus via the .renderLoaded
        fabric method of the current component.

        @focus {string|Error|Object} focus  the focus of the component`,
    isEnabled: true,
    rootValue: function renderLoaded (focus, component) {
      return component.renderLoaded(focus);
    },
  }));

  // Content lenses

  createSlotSymbol("undefinedLens", () => ({
    type: "Lens",
    description: `Slot for viewing an undefined focus.`,
    isEnabled: (focus) => (focus === undefined),
    rootValue: ({ delegate: [
      valos.Lens.instrument(
          (u, component) => (component.props.kuery || component.props.focus),
          valos.Lens.pendingFocusLens),
    ] }),
  }));

  createSlotSymbol("nullLens", () => ({
    type: "Lens",
    description: `Slot for viewing a null focus.`,
    isEnabled: (focus) => (focus === null),
    rootValue: "",
  }));

  createSlotSymbol("lens", () => ({
    type: "Lens",
    description: `Slot for viewing the focus of a fully loaded
        component. This slow is undefined by default. If a lens is
        placed into this slot it is rendered after focus and all
        props are loaded and activated but only if the focus is valid.
        The focus is valid if it is not a resource or if it is
        an active Resource (not unavailable or destroyed).

        @focus {Object} focus  the focus of the component.`,
    isEnabled: true,
    rootValue: undefined,
  }));

  createSlotSymbol("resourceLens", () => ({
    type: "Lens",
    description: `Slot for viewing the focused Resource via the
        connection state lens slot sequence. Delegates the viewing
        to a lens slot based on whether the focus is is inactive,
        activating, active, destroyer or unavailable.
        Note: This lens slot will initiate the activation of the focus!

        @focus {Resource} focus  the Resource focus.`,
    // TODO(iridian, 2019-03): Is this actually correct? Semantically
    // activating the lens inside isEnabled is fishy.
    // Maybe this was intended to be refreshPhase instead?
    isEnabled: (focus?: Vrapper) => (focus instanceof Vrapper) && (focus.activate() || true),
    rootValue: ({ delegate: [
      valos.Lens.activeLens,
      valos.Lens.activatingLens,
      valos.Lens.inactiveLens,
      valos.Lens.destroyedLens,
      valos.Lens.unavailableLens,
    ] }),
  }));

  createSlotSymbol("activeLens", () => ({
    type: "Lens",
    description: `Slot for viewing an active focused Resource.

        @focus {Object} focus  the active Resource focus.`,
    isEnabled: (focus?: Vrapper) => focus && focus.isActive(),
    rootValue: valos.Lens.focusPropertyLens,
  }));

  createSlotSymbol("lensProperty", () => ({
    type: "(string | string[])",
    description: `Slot which contains the property name (or array of
        names) that is retrieved from a Resource to be used a property
        lens. This slot is used by all lens property lenses as the
        default fallback property name.`,
  }));

  _createLensPropertySlots("focusLensProperty", ["FOCUS_LENS"],
      "focusPropertyLens", "lensPropertyNotFoundLens");
  _createLensPropertySlots("delegateLensProperty", ["DELEGATE_LENS"],
      "delegatePropertyLens", "notLensResourceLens");

  function _createLensPropertySlots (specificLensPropertySlotName, defaultLensProperties,
      propertyLensName, notFoundName) {
    const slotSymbol = createSlotSymbol(specificLensPropertySlotName, () => ({
      type: "(string | string[])",
      description: `Slot which contains the property name that is
          searched from the Resource focus when resolving the
          *${propertyLensName}* lens. Can be an array of property names
          in which case they are searched in order and the first
          property with not-undefined value is selected.`,
      isEnabled: undefined,
      rootValue: defaultLensProperties,
    }));

    createSlotSymbol(propertyLensName, () => ({
      type: "Lens",
      description: `Slot for viewing the focused Resource via
          a *property lens* read from the focus Resource itself. By
          default searches the focused Resource for a property with the
          name specified in slot '${specificLensPropertySlotName}'.
          If no lens property is found falls back to searching property
          with name props.lensProperty or context[valos.Lens.lensProperty].
          The props/context property name can also be an array, in which
          case the first matching lens is returned.

          If still no suitable lens can be found delegates the viewing
          to '${notFoundName || "null"}'.

          @focus {Object} focus  the Resource to search the lens from.`,
      isEnabled: (focus?: Vrapper) => focus && focus.hasInterface("Scope"),
      rootValue: function propertyLensNameGetter (focus: any, component: UIComponent,
          currentSlotName: string) {
        if (component.props.lensName) {
          console.error("DEPRECATED: props.lensName\n\tprefer: props.lensProperty",
              "\n\tlensName:", JSON.stringify(component.props.lensName),
              "\n\tin component:", component.debugId(), component);
        }
        const lensPropertyNames = [].concat(
            component.props[specificLensPropertySlotName]
                || component.getUIContextValue(slotSymbol)
                || component.context[specificLensPropertySlotName] || [],
            component.props.lensName || [], // Deprecated.
            component.props.lensProperty
                || component.getUIContextValue(valos.Lens.lensProperty)
                || component.context.lensProperty || []);
        const focusLexicalScope = focus.getLexicalScope();
        for (const propertyName of lensPropertyNames) {
          let vProperty;
          if (focusLexicalScope.hasOwnProperty(propertyName)) {
            vProperty = focusLexicalScope[propertyName];
          } else {
            vProperty = focus.get(VALEK.property(propertyName));
          }
          if (vProperty) {
            component.bindLiveKuery(
                `props_${specificLensPropertySlotName}_${currentSlotName}`, vProperty, "value", {
                  scope: component.getUIContext(),
                  onUpdate: function updateLensPropertyComponent () { component.forceUpdate(); },
                  updateImmediately: false,
                });
            const propertyValue = vProperty.extractValue();
            if (propertyValue !== undefined) return propertyValue;
          }
        }
        /*
        console.error("Can't find resource lens props:", specificLensPropertySlotName, slotSymbol,
            "\n\tnames:", lensPropertyNames,
            "\n\tcomponent:", component,
            "\n\tfocus:", focus);
        */
        if (!notFoundName) return null;
        return { delegate: [valos.Lens[notFoundName]] };
      },
    }));
  }

  // Valoscope lenses

  createSlotSymbol("scopeChildren", () => ({
    type: "any",
    description: `The child element(s) of the innermost enclosing
        Valoscope-like parent component.`,
  }));

  // Instance lenses

  createSlotSymbol("unframedLens", () => ({
    type: "Lens",
    description: `Slot for viewing a Valoscope which has not
        yet loaded its lens frame.`,
    isEnabled: (focus, component) => !component.state || (component.state.scopeFrame === undefined),
    rootValue: function renderUnframed () {
      return "<Loading frame...>";
    },
  }));

  createSlotSymbol("instanceLens", () => ({
    type: "Lens",
    description: `Slot for viewing the focus through an instance lens.`,
    isEnabled: (focus, component) => component.props.instanceLensPrototype,
    rootValue: function renderInstance (focus, component, currentSlotName) {
      return thenChainEagerly(
          component.state.scopeFrame, [
            (scopeFrame => {
              if ((scopeFrame == null) || !(scopeFrame instanceof Vrapper)) return "";
              if (!scopeFrame.hasInterface("Scope")) return scopeFrame;
              const instanceSlotName = `instance-${currentSlotName}`;
              const instanceLens = component.getUIContextValue(valos.Lens.instancePropertyLens)(
                  scopeFrame, component, instanceSlotName);
              return (instanceLens != null) ? instanceLens : scopeFrame;
            }),
          ]);
    },
  }));

  _createLensPropertySlots("instanceLensProperty", ["INSTANCE_LENS"], "instancePropertyLens");

  createSlotSymbol("instanceLensPrototype", () => ({
    type: "Resource",
    description: `Lens frame prototype Resource. Only valid when given as component props.`,
  }));

  createSlotSymbol("scopeFrameResource", () => ({
    type: "Resource",
    description: `Current innermost enclosing scope frame which is also
        a Resource. Used as the owner for any scope frames created for
        any of its child components.`,
  }));

  createSlotSymbol("obtainScopeFrame", () => ({
    type: "(prototype: Resource, owner: Resource, focus: any, lensName: string): Resource",
    description: `Returns an existing or creates a new Resource or object to be
        used as the scope frame for a Valoscope component. This scope
        frame is then made available as 'frame' to its child lenses via
        context. By default creates a valos Resource as follows:
        1. A *derived id* for the Resource will be derived using rules
          described below. If a Resource by that id exists that Resource
          will be used as-is.
          Otherwise a new Resource is created with that id.
        2. If defined the *prototype* is used as part of the id
          derivation and the possible new Resource will use the
          prototype as its Resource.instancePrototype. Additionally if
          the prototype has a lens authority property its value will be
          defined as the *lens authority*.
          Otherwise (if prototype is undefined) a new Entity is created.
        3. If *focus* is a singular Resource its id is used as part of
          the id derivation. Then if lens authority is not yet defined
          and if the focus has a lens authority property its value will
          is defined as the lens authority. Alternatively, if the focus
          is a chronicle root then valos.shadowLensAuthority is
          defined as the lens authority.
          Otherwise (focus is not a singular Resource) focus is not used
          in id derivation.
        4. If defined the *owner* is used as part of the id derivation.
        5. If the lens authority is defined and is not falsy it's used as
          the Chronicle.authorityURI of the possible new
          Resource.
          Otherwise if the *owner* is defined its used as Resource.owner
          for the possible new Resource.
          Otherwise no scope frame is obtained and frame is set to null.
          Note that even if a new chronicle is created for a Resource
          (in which case it will not be given an owner) the owner id and
          lens name are used as part of the id derivation.
        6. If the component has a custom key then it will be used as part
          of the id derivation. Additionally if the surrounding context
          defines a non-falsy 'frame' then the obtained scope frame that
          is obtained is also assigned to 'frame[key]'.
          Otherwise an autogenerated key which accounts for the relative
          position of the component inside its lens definition file is
          used as part of the id derivation.
        7. A scope frame is *elidable* if
          1. its component has an autogenerated key,
          2. its child lenses don't refer to 'this', and
          3. each of its immediately descendant Valoscope child
              components is either elidable itself or has
              an autogenerated key and defines lens authority.
          An implementation may skip the creation of an elidable scope
          frame. This is true even if it would have side effects that
          are visible elsewhere (ie. a scope frame creation can be
          elided even if it would be created into a remote authority).
    `,
    isEnabled: undefined,
    rootValue: function obtainScopeFrame (prototype: Vrapper, owner: Vrapper, focus: any,
        lensName: string = "", component: UIComponent) {
      let ownerPart = "";
      const vFocus = (focus != null) && (focus instanceof Vrapper) && focus;
      const focusPart = (vFocus && vFocus.getRawId()) || "";
      let prototypePart = "";
      if (owner != null) {
        if (owner instanceof Vrapper) ownerPart = owner.getRawId();
        else throw new Error(`obtainScopeFrame.owner expects a Resource, got ${debugId(owner)}`);
      }
      if (prototype != null) {
        if (prototype instanceof Vrapper) prototypePart = prototype.getRawId();
        else {
          throw new Error(`obtainScopeFrame.prototype is defined but is not a Resource, got ${
            debugId(prototype)}`);
        }
      }
      let frameRawId = derivedId(
          prototypePart, `frames-${encodeURIComponent(lensName)}`, ownerPart);
      if (focusPart) frameRawId = derivedId(focusPart, "foci", frameRawId);
      // "postLoadProperties" and "options" are optional arguments
      const engine = component.context.engine;
      const vResource = engine.tryVrapper(frameRawId, { optional: true });
      if (vResource !== undefined) return vResource;

      const vFocusActivation = vFocus && vFocus.activate();
      let lensAuthorityURI;
      let discourse;
      return thenChainEagerly(prototype && prototype.activate(), [
        () => vFocusActivation, // This might be redundant, focus could have been waited on.
        () => {
          const lensAuthorityProperty = component
              .getUIContextValue(valos.Lens.lensAuthorityProperty);
          if ((prototype != null) && lensAuthorityProperty && prototype.hasInterface("Scope")) {
            lensAuthorityURI = prototype.propertyValue(lensAuthorityProperty);
          }
          if ((lensAuthorityURI === undefined) && (focusPart !== "")) {
            const currentShadowedFocus =
                component.getParentUIContextValue(valos.Lens.shadowedFocus);
            if (vFocus !== currentShadowedFocus) {
              if (lensAuthorityProperty && (vFocus.hasInterface("Scope"))) {
                lensAuthorityURI = vFocus.propertyValue(lensAuthorityProperty);
              }
              if ((lensAuthorityURI === undefined) && vFocus.isChronicleRoot()) {
                lensAuthorityURI = component.getUIContextValue(valos.Lens.shadowLensAuthority);
              }
            }
          }
        },
        () => {
          if (!lensAuthorityURI) return undefined;
          if (prototypePart && !prototype.hasInterface("Chronicle")) {
            lensAuthorityURI = "";
            return undefined;
          }
          if (!lensAuthorityURI && !owner) {
            throw new Error(`Cannot obtain scope frame: neither authorityURI ${
                ""}nor owner could be determined`);
          }
          const chronicleURI = naiveURI.createChronicleURI(lensAuthorityURI, frameRawId);
          return engine.discourse.acquireConnection(chronicleURI)
              .asActiveConnection();
        },
        (connection: ?Connection) => {
          if (connection) {
            const vResource_ = engine.tryVrapper(frameRawId, { optional: true });
            if (vResource_) return vResource_;
          }
          const initialState = {
            id: frameRawId,
            name: `FRAME-${lensName}=>${
                prototype ? prototype.get("name") || prototypePart : "Entity"}->${
                (vFocus && vFocus.hasInterface("Scope") && vFocus.get("name")) || focusPart}`,
          };
          if (lensAuthorityURI) initialState.authorityURI = lensAuthorityURI;
          else initialState.owner = owner;
          discourse = engine.getActiveGlobalOrNewLocalEventGroupTransaction();
          /*
          discourse = engine.obtainGroupTransaction("receive-events", {
            finalizer: Promise.resolve(),
          });
          */
          // TODO(iridian, 2019-01): Determine whether getPremiereStory
          // is the desired semantics here. It waits until the
          // resource creation narration has completed (ie. engine
          // has received and resolved the recital): this might be
          // unnecessarily long.
          // OTOH: TransactionState.chronicleEvents.results only
          // support getPremiereStory so whatever semantics is
          // desired it needs to be implemented.
          // const options = { discourse, awaitResult: result => result.getPremiereStory() };
          const options = { discourse, awaitResult: result => result.getComposedStory() };
          return (prototype != null)
              ? prototype.instantiate(initialState, options)
              : engine.create("Entity", initialState, options);
        },
        (vResource_) => {
          if ((lensAuthorityURI !== undefined) && vFocus) {
            component.setUIContextValue(valos.Lens.shadowedFocus, vFocus);
            component.setUIContextValue(valos.Lens.shadowLensChronicleRoot,
                lensAuthorityURI ? vResource_ : null);
          }
          return vResource_;
        },
      ]);
    }
  }));

  createSlotSymbol("lensAuthorityProperty", () => ({
    type: "(string)",
    description: `Slot which contains the property name that is used
        when searching for an authority URI string.
        This property will be searched for from a lens instance
        prototype or a Resource focus when obtaining a lens frame.
        If found the authority URI will be used for the lens chronicle.
        If the chronicle didn't already exist new lens chronicle is
        created in that authority URI with a new scope frame resource
        as its chronicle root.`,
    isEnabled: undefined,
    rootValue: "LENS_AUTHORITY",
  }));

  createSlotSymbol("shadowLensChronicleRoot", () => ({
    type: "(Resource | null)",
    description: `Slot which contains the resource that is the root
        resource of the current shadow lens chronicle. A shadow lens
        chronicle is the chronicle which was created to contain lens
        states for a particular focus resource. This focused resource
        is maintained in slot 'shadowedFocus'.`,
  }));

  createSlotSymbol("shadowedFocus", () => ({
    type: "(Resource | null)",
    description: `Slot which contains a resource that is being shadowed
        by a shadow lens chronicle (the root resource of this chronicle
        is stored in slot 'shadowLensChronicleRoot'). This slot is used
        to detect if a particular focus is already being shadowed in
        which case no new shadow chronicle will needlessly be created.`,
  }));

  createSlotSymbol("shadowLensAuthority", () => ({
    type: "(string | null)",
    description: `Slot which contains the default lens authority URI
        for scope frames which have a chronicle root Resource as their
        focus. Used when a lens authority is not explicitly provided
        via property stored 'lensAuthorityProperty' of the instance or
        of the focus.`,
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
        {valos.Lens.instrument(parentComponentLens, focusDetailLens)}
      </span>
    </div>,
  ];

  createSlotSymbol("disabledLens", () => ({
    type: "Lens",
    description: `Slot for viewing an explicitly disabled component.

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
    description: `Slot for viewing a description of a generic dependency
        which is a pending promise. If the lens placed to this slot
        returns a promise then 'internalErrorLens' is displayed instead.

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
    description: `Slot for viewing a generic lens Promise failure.

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
            {valos.Lens.instrument(error => error.lens, focusDetailLens)}
          </span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  createSlotSymbol("pendingConnectionsLens", () => ({
    type: "Lens",
    description: `Slot for viewing a description of chronicle
        connection(s) that are being acquired.

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
    description: `Slot for viewing chronicle connection failure(s).

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
            {valos.Lens.instrument(error => error.resource, focusDescriptionLens)}
          </span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  createSlotSymbol("pendingActivationLens", () => ({
    type: "Lens",
    description: `Slot for viewing a description of the focused
        resource that is pending activation.

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
    description: `Slot for viewing resource activation failure(s).

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
            {valos.Lens.instrument(error => error.resource, focusDescriptionLens)}
          </span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));
  createSlotSymbol("inactiveLens", () => ({
    type: "Lens",
    description: `Slot for viewing a focused inactive Resource.

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
    description: `Slot for viewing a description of a focused
        Media whose content is being downloaded.

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
    description: `Slot for viewing a description of a focused
        Media which is being interpreted (ie. downloaded, decoded and
        integrated).

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
    description: `Slot for viewing the focused failure on why
        a particular media interpretation could not be rendered.

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
            {valos.Lens.instrument(error => error.media, focusDescriptionLens)}
          </span>
        </div>
        <div {..._parameter}>
          <span {..._key}>Interpretation info:</span>
          <span {..._value}>
            {valos.Lens.instrument(error => error.mediaInfo, valos.Lens.focusDetail)}
          </span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  createSlotSymbol("unrenderableMediaInterpretationLens", () => ({
    type: "Lens",
    description: `Slot for viewing a focused media with an
        interpretation that cannot or should not be rendered (such as
        octet stream, complex native object or an undefined value).

        @focus {string|Error|Object} reason  interpretation render failure reason.`,
    isEnabled: true,
    rootValue: valos.Lens.failedMediaInterpretationLens,
  }));

  createSlotSymbol("mediaInterpretationErrorLens", () => ({
    type: "Lens",
    description: `Slot for viewing a focused error that was
        encountered during media interpretation.

        @focus {string|Error|Object} reason  interpretation error.`,
    isEnabled: true,
    rootValue: valos.Lens.failedMediaInterpretationLens,
  }));

  createSlotSymbol("pendingFocusLens", () => ({
    type: "Lens",
    description: `Slot for viewing a component with an unfinished
        focus kuery.

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
    description: `Slot for viewing a description of one or more
        unfinished props kueries.

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
    description: `Slot for viewing the description of props which
        are pending Promises.

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
    description: `Slot for viewing a props Promise failure.

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
            {valos.Lens.instrument(error => error.propsNames, focusDetailLens)}
          </span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  createSlotSymbol("pendingChildrenLens", () => ({
    type: "Lens",
    description: `Slot for viewing a description of pending children Promise.

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
    description: `Slot for viewing a child Promise failure.

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
            {valos.Lens.instrument(error => error.children, focusDetailLens)}
          </span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  createSlotSymbol("activatingLens", () => ({
    type: "Lens",
    description: `Slot for viewing an activating Resource.

        @focus {Object} focus  the activating Resource focus.`,
    isEnabled: (focus?: Vrapper) => focus && focus.isActivating(),
    rootValue: ({ delegate: [
      (focus, component) => {
        const activation = focus.activate();
        if (activation) activation.then(() => component.forceUpdate());
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
    description: `Slot for viewing an inactive Resource.

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
    description: `Slot for viewing an unavailable Resource.

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
    description: `Slot for viewing a destroyed Resource.

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
    description: `Slot for viewing a description of an active Resource
        focus which does not have a requested lens property.

        @focus {Object} focus  the active Resource focus.`,
    isEnabled: true,
    rootValue: ({ delegate: [
      loadingFailedLens,
      <div {..._lensMessageLoadingFailedProps}>
        <div {..._message}>
          Cannot find a lens property from the active focus {focusDescriptionLens}.
        </div>
        <div {..._parameter}>
          <span {..._key}>focusLensProperty:</span>
          <span {..._value}>
            {valos.Lens.instrument(valos.Lens.focusLensProperty, p => JSON.stringify(p))}
          </span>
        </div>
        <div {..._parameter}>
          <span {..._key}>lensProperty:</span>
          <span {..._value}>
            {valos.Lens.instrument(valos.Lens.lensProperty, p => JSON.stringify(p))}
          </span>
        </div>
        <div {..._parameter}>
          <span {..._key}>Focus detail:</span>
          <span {..._value}>{focusDetailLens}</span>
        </div>
        <div {..._parameter}>
          <span {..._key}>Focus properties:</span>
          <span {..._value}>
            {valos.Lens.instrument(valos.Lens.propertyKeysLens, p => JSON.stringify(p))}
          </span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  createSlotSymbol("notLensResourceLens", () => ({
    type: "Lens",
    description: `Slot for viewing a Resource which cannot be used as a lens.

        @focus {Object} nonLensResource  the non-lens-able Resource.`,
    isEnabled: true,
    rootValue: ({ delegate: [
      loadingFailedLens,
      <div {..._lensMessageLoadingFailedProps}>
        <div {..._message}>
          Resource {focusDescriptionLens} cannot be used as
          a lens. This is because it is not a valid lens Media file and
          it does not have a lens property that is listed in either
          %27delegateLensProperty%27 or %27lensProperty%27 slots.
        </div>
        <div {..._parameter}>
          <span {..._key}>delegateLensProperty:</span>
          <span {..._value}>
            {valos.Lens.instrument(valos.Lens.delegateLensProperty, p => JSON.stringify(p))}
          </span>
        </div>
        <div {..._parameter}>
          <span {..._key}>lensProperty:</span>
          <span {..._value}>
            {valos.Lens.instrument(valos.Lens.lensProperty, p => JSON.stringify(p))}
          </span>
        </div>
        <div {..._parameter}>
          <span {..._key}>Resource detail:</span>
          <span {..._value}>{focusDetailLens}</span>
        </div>
        <div {..._parameter}>
          <span {..._key}>Resource properties:</span>
          <span {..._value}>
            {valos.Lens.instrument(valos.Lens.propertyKeysLens, p => JSON.stringify(p))}
          </span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  createSlotSymbol("arrayNotIterableLens", () => ({
    type: "Lens",
    description: `Slot for viewing a valoscope props.array which is
        not an iterable.

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
    description: `Slot for viewing an a description of an invalid UI element.

        @focus {Object} description  string or object description.`,
    isEnabled: true,
    rootValue: ({ delegate: [
      loadingFailedLens,
      <div {..._lensMessageLoadingFailedProps}>
        <div {..._message}>
            {valos.Lens.instrument(parentComponentLens, focusDetailLens)}
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

  finalizeLensDescriptors();
  return valos.Lens;
}
