// @flow

import React from "react";

import { denoteValaaBuiltinWithSignature } from "~/raem/VALK";
import { naiveURI } from "~/raem/ValaaURI";

import type { PartitionConnection } from "~/prophet";

import Vrapper from "~/engine/Vrapper";
import debugId from "~/engine/debugId";
import VALEK, { dumpObject } from "~/engine/VALEK";

import UIComponent from "~/inspire/ui/UIComponent";

import {
  arrayFromAny, derivedId, dumpify, messageFromError, thenChainEagerly, wrapError,
} from "~/tools";

type LensParameters = {
  type: string,
  description: string,
  isEnabled: ?(boolean | (focus: any, component: UIComponent) => boolean),
  rootValue: any,
  isStickyError: ?boolean,
};

export default function injectLensObjects (Valaa: Object, rootScope: Object,
    hostObjectDescriptors: Object) {
  Valaa.Lens = {};
  const lensDescriptorOptions: { [string]: () => LensParameters } = {};

  function createLensRoleSymbol (name: string, createLensParameters: Object) {
    lensDescriptorOptions[name] = createLensParameters;
    Valaa.Lens[name] = Symbol(name);
    Valaa.Lens[Valaa.Lens[name]] = name;
    return Valaa.Lens[name];
  }

  function finalizeLensDescriptors () {
    const lensDescriptors = {};
    Object.entries(lensDescriptorOptions).forEach(
        ([lensRoleName, createLensParameters]) => {
          const { value, type, description, isEnabled, rootValue } = createLensParameters();
          const descriptor = {
            valaa: true, symbol: true,
            value, type, description,
            writable: false, enumerable: true, configurable: false,
          };
          if (isEnabled !== undefined) {
            Object.assign(descriptor, { lensRole: true, isEnabled });
          }
          lensDescriptors[lensRoleName] = Object.freeze(descriptor);
          hostObjectDescriptors.set(Valaa.Lens[lensRoleName], descriptor);
          if (rootValue) rootScope[Valaa.Lens[lensRoleName]] = Object.freeze(rootValue);
        });
    hostObjectDescriptors.set(Valaa.Lens, lensDescriptors);
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

  Valaa.Lens.instrument = denoteValaaBuiltinWithSignature(
      `function(lens1[, lens2[, ...[, lensN]]])
      Creates an _instrument lens_ by chaining multiple lenses in
      sequence. When an instrument lens is assigned into a lens role
      the instrument passes its focus to the first lens. Then it
      forwards the output of the first lens to the second lens and so
      on until the output of the last lens is displayed as the output
      of the instrument lens itself.`
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

  createLensRoleSymbol("activeViewRoles", () => ({
    type: "string[]",
    description: `Lens role for listing the lens role names that are
        being used to view this element itself.`,
  }));

  const niceActiveRoleNames = Valaa.Lens.instrument(
      Valaa.Lens.activeViewRoles,
      roleNames => roleNames.slice(0, -1).reverse().join(" <- "));

  createLensRoleSymbol("componentChildrenLens", () => ({
    type: "any[]",
    description: `Lens role for viewing the child elements of the
        current parent component.`,
    isEnabled: (u: any, component: UIComponent) => arrayFromAny(component.props.children).length,
    rootValue: function renderComponentChildren (u: any, component: UIComponent) {
      return component.props.children;
    },
  }));

  createLensRoleSymbol("parentComponentLens", () => ({
    type: "any[]",
    description: `Lens role for viewing the current parent component.
        As the component itself is not renderable this role should be
        used in an instrument along with some other role such as
        'focusDetailLens'.`,
    isEnabled: true,
    rootValue: function renderParentComponent (u: any, component: UIComponent) {
      return component;
    },
  }));

  createLensRoleSymbol("focusDescriptionLens", () => ({
    type: "Lens",
    description: `Lens role for viewing a description of the focus.

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

  createLensRoleSymbol("focusDetailLens", () => ({
    type: "Lens",
    description: `Lens role for viewing a developer-oriented debug
        introspection of the focus.

        @focus {any} focus  the focus to describe.`,
    isEnabled: true,
    rootValue: function renderFocusDetail (focus: any) {
      return debugId(focus);
    }
  }));

  createLensRoleSymbol("focusDumpLens", () => ({
    type: "Lens",
    description: `Lens role for viewing a full string dump of the focus.
        Replaces circular/duplicates with tags.

        @focus {any} focus  the focus to dump.`,
    isEnabled: true,
    rootValue: function renderFocusDump (focus: any) {
      return dumpify(focus, { indent: 2 });
    },
  }));

  createLensRoleSymbol("focusPropertyKeysLens", () => ({
    type: "Lens",
    description: `Lens role for viewing the list of property keys of
        the focused object or resource (using Object.keys).

        @focus {object | Resource} focus  the focus to describe.`,
    isEnabled: (focus) => focus && (typeof focus === "object"),
    rootValue: function renderFocusPropertyKeys (focus: any) {
      return (!focus || (typeof focus !== "object")
          ? undefined
          : Object.keys(!(focus instanceof Vrapper) ? focus : focus.getLexicalScope()));
    },
  }));

  createLensRoleSymbol("internalErrorLens", () => ({
    type: "Lens",
    description: `A catch-all lens role for viewing the focused
        internal error, such as an unhandled exception or a constraint
        violation like 'pendingLens' resulting in a promise.
        By default renders the yelling-red screen.

        @focus {string|Error} error  the failure description or exception object`,
    isEnabled: true,
    rootValue: function renderInternalFailure () {
      return (
        <div {..._lensMessageInternalFailureProps}>
          Render Error: Component has internal error(s).
          {Valaa.Lens.toggleableErrorDetailLens}
        </div>
      );
    },
  }));

  createLensRoleSymbol("toggleableErrorDetailLens", () => ({
    type: "Lens",
    description: `A catch-all lens role for rendering a detailed,
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

  // Main component lifecycle lens

  createLensRoleSymbol("valaaScopeLens", () => ({
    type: "Lens",
    description: `Lens role for viewing the focus via the ValaaScope
        lens role sequence. ValaaScope is an internal fabric component
        which delegates the viewing to specialized lens roles based on
        the current dynamic state and/or value of the focus.

        @focus {any} focus  the focus of the component`,
    isEnabled: true,
    rootValue: ({ delegate: Object.freeze([
      Valaa.Lens.firstEnabledDelegateLens,
      Valaa.Lens.disabledLens,
      Valaa.Lens.unframedLens,
      Valaa.Lens.instanceLens,
      Valaa.Lens.undefinedLens,
      Valaa.Lens.lens,
      Valaa.Lens.nullLens,
      Valaa.Lens.componentChildrenLens,
      Valaa.Lens.resourceLens,
      Valaa.Lens.loadedLens,
    ]) }),
  }));

  createLensRoleSymbol("livePropsLens", () => ({
    type: "Lens",
    description: `Lens role for viewing the focus via the LiveProps
        lens role sequence. LiveProps is an internal fabric component
        which triggers the dynamic update of the UI in response to
        events coming downstream the prophet chain.

        @focus {any} focus  the focus of the component`,
    isEnabled: true,
    rootValue: ({ delegate: Object.freeze([
      Valaa.Lens.firstEnabledDelegateLens,
      Valaa.Lens.disabledLens,
      Valaa.Lens.undefinedLens,
      Valaa.Lens.loadedLens,
    ]) }),
  }));

  createLensRoleSymbol("uiComponentLens", () => ({
    type: "Lens",
    description: `Lens role for viewing the focus via the UIComponent
        role sequence. UIComponent is an internal fabric base class
        and responsible for connecting the lens system into the React
        implementation.

        @focus {string|Error|Object} focus  the focus of the component`,
    isEnabled: true,
    rootValue: ({ delegate: [
      Valaa.Lens.firstEnabledDelegateLens,
      Valaa.Lens.disabledLens,
      Valaa.Lens.undefinedLens,
      Valaa.Lens.loadedLens,
    ] }),
  }));


  createLensRoleSymbol("firstEnabledDelegateLens", () => ({
    type: "Lens",
    description: `Lens role for viewing the focus via the first enabled
        role in the props.delegate of the current fabric component.

        @focus {string|Error|Object} focus  the focus of the component`,
    isEnabled: (u, component) => (component.props.delegate !== undefined),
    rootValue: function renderFirstEnabledDelegate (focus, component, lensName = "delegate") {
      return component.renderFirstEnabledDelegate(component.props.delegate, focus, lensName);
    }
  }));

  createLensRoleSymbol("loadedLens", () => ({
    type: "Lens",
    description: `Lens role for viewing the focus via the
        .renderLoaded method of the current fabric component.

        @focus {string|Error|Object} focus  the focus of the component`,
    isEnabled: true,
    rootValue: function renderLoaded (focus, component) {
      return component.renderLoaded(focus);
    },
  }));

  // Content lenses

  createLensRoleSymbol("undefinedLens", () => ({
    type: "Lens",
    description: `Lens role for viewing an undefined focus.`,
    isEnabled: (focus) => (focus === undefined),
    rootValue: ({ delegate: [
      Valaa.Lens.instrument(
          (u, component) => (component.props.kuery || component.props.focus),
          Valaa.Lens.kueryingFocusLens),
    ] }),
  }));

  createLensRoleSymbol("nullLens", () => ({
    type: "Lens",
    description: `Lens role for viewing a null focus.`,
    isEnabled: (focus) => (focus === null),
    rootValue: "",
  }));

  createLensRoleSymbol("lens", () => ({
    type: "Lens",
    description: `Lens role for explicitly viewing the focus of
        a fully loaded component. This role is always rendered after
        focus and all props are active and loaded but only when focus
        is valid. As this role has no default root value it is only
        used if the creator of the current component has explicitly
        specified this role.

        @focus {Object} focus  the focus of the component.`,
    isEnabled: true,
    rootValue: undefined,
  }));

  createLensRoleSymbol("resourceLens", () => ({
    type: "Lens",
    description: `Lens role for viewing the focused Resource via
        the connection state lens role sequence. Delegates the viewing
        to a lens role based on whether the focus is is inactive,
        activating, active, destroyer or unavailable.
        Note: This lens role will initiate the activation of the focus!

        @focus {Resource} focus  the Resource focus.`,
    // TODO(iridian, 2019-03): Is this actually correct? Semantically
    // activating the lens inside isEnabled is fishy.
    // Maybe this was intended to be refreshPhase instead?
    isEnabled: (focus?: Vrapper) => (focus instanceof Vrapper) && (focus.activate() || true),
    rootValue: ({ delegate: [
      Valaa.Lens.activeLens,
      Valaa.Lens.activatingLens,
      Valaa.Lens.inactiveLens,
      Valaa.Lens.destroyedLens,
      Valaa.Lens.unavailableLens,
    ] }),
  }));

  createLensRoleSymbol("activeLens", () => ({
    type: "Lens",
    description: `Lens role for explitlty viewing an active focused
        Resource.

        @focus {Object} focus  the active Resource focus.`,
    isEnabled: (focus?: Vrapper) => focus && focus.isActive(),
    rootValue: Valaa.Lens.focusPropertyLens,
  }));

  createLensRoleSymbol("lensProperty", () => ({
    type: "(string | string[])",
    description: `Lens role for the name or array of property names that are
        searched from a Resource when looking for a property lens.
        This role is shared by all property lenses.`,
  }));

  _createLensPropertyRoles("focusLensProperty", ["FOCUS_LENS"],
      "focusPropertyLens", "lensPropertyNotFoundLens");
  _createLensPropertyRoles("delegateLensProperty", ["DELEGATE_LENS"],
      "delegatePropertyLens", "notLensResourceLens");

  function _createLensPropertyRoles (lensPropertyRoleName, defaultLensNames, propertyLensRoleName,
      notFoundName) {
    const roleSymbol = createLensRoleSymbol(lensPropertyRoleName, () => ({
      type: "(string | string[])",
      description: `Lens role for the name or array of property names
          that are searched from the Resource focus when resolving the
          *${propertyLensRoleName}* role.`,
      isEnabled: undefined,
      rootValue: defaultLensNames,
    }));

    createLensRoleSymbol(propertyLensRoleName, () => ({
      type: "Lens",
      description: `Lens role for viewing the focused Resource via
          a *property lens* provided by the Resource itself. By default
          searches the focused Resource for a property with the name
          specified by props.${lensPropertyRoleName} or
          context[Valaa.Lens.${lensPropertyRoleName}].
          If no lens property is found falls back to searching property
          with name props.lensProperty or context[Valaa.Lens.lensProperty].
          The props/context property name can also be an array, in which
          case the first matching lens is returned.

          If still no suitable lens can be found delegates the viewing
          to '${notFoundName || "null"}'.

          @focus {Object} focus  the Resource to search the lens from.`,
      isEnabled: (focus?: Vrapper) => focus && focus.hasInterface("Scope"),
      rootValue: function propertyLensRoleNameGetter (focus: any, component: UIComponent,
          lensRoleName: string) {
        if (component.props.lensName) {
          console.error("DEPRECATED: props.lensName\n\tprefer: props.lensProperty",
              "\n\tlensName:", JSON.stringify(component.props.lensName),
              "\n\tin component:", component.debugId(), component);
        }
        const lensPropertyNames = [].concat(
            component.props[lensPropertyRoleName]
                || component.getUIContextValue(roleSymbol)
                || component.context[lensPropertyRoleName] || [],
            component.props.lensName || [], // Deprecated.
            component.props.lensProperty
                || component.getUIContextValue(Valaa.Lens.lensProperty)
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
            component.bindNewKuerySubscription(`props_${lensPropertyRoleName}_${lensRoleName}`,
                vProperty, "value", { scope: component.getUIContext(), noImmediateRun: true },
                () => component.forceUpdate());
            const propertyValue = vProperty.extractValue();
            if (propertyValue !== undefined) return propertyValue;
          }
        }
        /*
        console.error("Can't find resource lens props:", lensPropertyRoleName, roleSymbol,
            "\n\tnames:", lensPropertyNames,
            "\n\tcomponent:", component,
            "\n\tfocus:", focus);
        */
        if (!notFoundName) return null;
        return { delegate: [Valaa.Lens[notFoundName]] };
      },
    }));
  }

  // ValaaScope lenses

  createLensRoleSymbol("scopeChildren", () => ({
    type: "any",
    description: `The child element(s) of the innermost enclosing
        ValaaScope-like parent component.`,
  }));

  // Instance lenses

  createLensRoleSymbol("unframedLens", () => ({
    type: "Lens",
    description: `Lens role for viewing a ValaaScope which has not
        yet loaded its lens frame.`,
    isEnabled: (focus, component) => !component.state || (component.state.scopeFrame === undefined),
    rootValue: function renderUnframed () {
      return "<Loading frame...>";
    },
  }));

  createLensRoleSymbol("instanceLens", () => ({
    type: "Lens",
    description: `Lens role for viewing the focus through an instance lens.`,
    isEnabled: (focus, component) => component.props.instanceLensPrototype,
    rootValue: function renderInstance (focus, component, lensRoleName) {
      return thenChainEagerly(
          component.state.scopeFrame, [
            (scopeFrame => {
              if ((scopeFrame == null) || !(scopeFrame instanceof Vrapper)) return "";
              if (!scopeFrame.hasInterface("Scope")) return scopeFrame;
              const instanceRoleName = `instance-${lensRoleName}`;
              const instanceLens = component.getUIContextValue(Valaa.Lens.instancePropertyLens)(
                  scopeFrame, component, instanceRoleName);
              return (instanceLens != null) ? instanceLens : scopeFrame;
            }),
          ]);
    },
  }));

  _createLensPropertyRoles("instanceLensProperty", ["INSTANCE_LENS"], "instancePropertyLens");

  createLensRoleSymbol("instanceLensPrototype", () => ({
    type: "Resource",
    description: `Lens frame prototype Resource. Only valid when given as component props.`,
  }));

  createLensRoleSymbol("scopeFrameResource", () => ({
    type: "Resource",
    description: `Current innermost enclosing scope frame which is also
        a Resource. Used as the owner for any scope frames created for
        any of its child components.`,
  }));

  createLensRoleSymbol("obtainScopeFrame", () => ({
    type: "(prototype: Resource, owner: Resource, focus: any, lensName: string): Resource",
    description: `Returns an existing or creates a new Resource or object to be
        used as the scope frame for a ValaaScope component. This scope
        frame is then made available as 'frame' to its child lenses via
        context. By default creates a Valaa Resource as follows:
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
          is a partition root then Valaa.shadowLensAuthority is
          defined as the lens authority.
          Otherwise (focus is not a singular Resource) focus is not used
          in id derivation.
        4. If defined the *owner* is used as part of the id derivation.
        5. If the lens authority is defined and is not falsy it's used as
          the Partition.partitionAuthorityURI of the possible new
          Resource.
          Otherwise if the *owner* is defined its used as Resource.owner
          for the possible new Resource.
          Otherwise no scope frame is obtained and frame is set to null.
          Note that even if a new partition is created for a Resource
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
          3. each of its immediately descendant ValaaScope child
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
      const frameRawId = derivedId(ownerPart, `-${lensName}-${focusPart}`, prototypePart);
      // "postLoadProperties" and "options" are optional arguments
      const engine = component.context.engine;
      const vResource = engine.tryVrapper(frameRawId, { optional: true });
      if (vResource !== undefined) return vResource;

      const vFocusActivation = vFocus && vFocus.activate();
      let lensAuthorityURI;
      let transaction;
      return thenChainEagerly(prototype && prototype.activate(), [
        () => vFocusActivation, // This might be redundant, focus could have been waited on.
        () => {
          const lensAuthorityProperty = component
              .getUIContextValue(Valaa.Lens.lensAuthorityProperty);
          if ((prototype != null) && lensAuthorityProperty && prototype.hasInterface("Scope")) {
            lensAuthorityURI = prototype.propertyValue(lensAuthorityProperty);
          }
          if ((lensAuthorityURI === undefined) && (focusPart !== "")) {
            const currentShadowedFocus =
                component.getParentUIContextValue(Valaa.Lens.shadowedFocus);
            if (vFocus !== currentShadowedFocus) {
              if (lensAuthorityProperty && (vFocus.hasInterface("Scope"))) {
                lensAuthorityURI = vFocus.propertyValue(lensAuthorityProperty);
              }
              if ((lensAuthorityURI === undefined) && vFocus.isPartitionRoot()) {
                lensAuthorityURI = component.getUIContextValue(Valaa.Lens.shadowLensAuthority);
              }
            }
          }
        },
        () => {
          if (!lensAuthorityURI) return undefined;
          if (prototypePart && !prototype.hasInterface("Partition")) {
            lensAuthorityURI = "";
            return undefined;
          }
          if (!lensAuthorityURI && !owner) {
            throw new Error(`Cannot obtain scope frame: neither partitionAuthorityURI ${
                ""}nor owner could be determined`);
          }
          const partitionURI = naiveURI.createPartitionURI(lensAuthorityURI, frameRawId);
          return engine.getProphet().acquirePartitionConnection(partitionURI)
              .getActiveConnection();
        },
        (connection: ?PartitionConnection) => {
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
          if (lensAuthorityURI) initialState.partitionAuthorityURI = lensAuthorityURI;
          else initialState.owner = owner;
          transaction = engine.obtainTransientGroupingTransaction("frame-construction");
          // TODO(iridian, 2019-01): Determine whether getPremiereStory
          // is the desired semantics here. It waits until the
          // resource creation narration has completed (ie. engine
          // has received and resolved the recital): this might be
          // unnecessarily long.
          // OTOH: TransactionInfo.chronicleEvents.results only
          // support getPremiereStory so whatever semantics is
          // desired it needs to be implemented.
          const options = { transaction, awaitResult: result => result.getPremiereStory() };
          return (prototype != null)
              ? prototype.instantiate(initialState, options)
              : engine.create("Entity", initialState, options);
        },
        (vResource_) => {
          if ((lensAuthorityURI !== undefined) && vFocus) {
            component.setUIContextValue(Valaa.Lens.shadowedFocus, vFocus);
            component.setUIContextValue(Valaa.Lens.shadowLensPartitionRoot,
                lensAuthorityURI ? vResource_ : null);
          }
          return vResource_;
        },
      ]);
    }
  }));

  createLensRoleSymbol("lensAuthorityProperty", () => ({
    type: "(string)",
    description: `Lens role for a property name that is used when searching for an
        authority URI string.
        This property will be searched for from a lens instance prototype
        or a Resource focus when obtaining a lens frame. If found the
        authority URI will be used for the lens partition. If the
        partition didn't already exist new lens partition is created in
        that authority URI with a new scope frame resource as its
        partition root.`,
    isEnabled: undefined,
    rootValue: "LENS_AUTHORITY",
  }));

  createLensRoleSymbol("shadowLensPartitionRoot", () => ({
    type: "(Resource | null)",
    description: `Lens role for the resource which is the root resource of
        the current a shadow lens partition. A shadow lens partition is
        the partition which was created to contain lens state for
        a particular focus resource (which is found in
        Valaa.Lens.shadowedFocus).`,
  }));

  createLensRoleSymbol("shadowedFocus", () => ({
    type: "(Resource | null)",
    description: `Lens role for a partition that is being shadowed by a shadow
        lens partition (which is found in
        Valaa.Lens.shadowLensPartitionRoot). This role is used to detect
        if a particular focus is already being shadowed in which case no
        new shadow partition will needlessly be created.`,
  }));

  createLensRoleSymbol("shadowLensAuthority", () => ({
    type: "(string | null)",
    description: `Lens role for the default lens authority URI for scope frames
        which have a partition root Resource as their focus. Used when
        a lens authority is not defined via other means, such as
        an explicit instance or focus lens authority property.`,
    isEnabled: undefined,
    rootValue: "valaa-memory:",
  }));

  // User-definable catch-all lenses

  createLensRoleSymbol("loadingLens", () => ({
    type: "Lens",
    description: `A catch-all lens role for viewing a description of a
        dependency which is still being loaded.
        Unassigned by default; assign a lens to this role to have all the
        *default* implementations of all other loading -like roles
        delegate to this role (instead of using their own default lens).

        @focus {Object} component  an object description of the dependency being loaded`,
  }));

  createLensRoleSymbol("loadingFailedLens", () => ({
    type: "Lens",
    description: `A catch-all lens role for viewing a description of a
        dependency which has failed to load.
        Unassigned by default; assign a lens to this role to have all the
        *default* implementations of all other loading-failed -like roles
        delegate to this role (instead of using their own default lens).

        @focus {string|Error|Object} reason  the explanation of the loading failure`,
  }));

  // Main component lens sequence and failure lenses

  const commonMessageRows = [
    <div {..._lensChain}>
      <span {..._key}>Lens role delegation:</span>
      <span {..._value}>{niceActiveRoleNames}</span>
    </div>,
    <div {..._component}>
      <span {..._key}>Containing component:</span>
      <span {..._value}>
        {Valaa.Lens.instrument(Valaa.Lens.parentComponentLens, Valaa.Lens.focusDetailLens)}
      </span>
    </div>,
  ];

  createLensRoleSymbol("disabledLens", () => ({
    type: "Lens",
    description: `Lens role for viewing an explicitly disabled component.

        @focus {string|Error|Object} reason  a description of why the component is disabled.`,
    isEnabled: (u, component) => ((component.state || {}).uiContext === undefined),
    rootValue: ({ delegate: [
      Valaa.Lens.loadingFailedLens,
      <div {..._lensMessageLoadingFailedProps}>
        <div {..._message}>Component is disabled; focus and context are not available.</div>
        <div {..._parameter}>
          <span {..._key}>Disable reason:</span>
          <span {..._value}>{Valaa.Lens.focusDetailLens}</span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  createLensRoleSymbol("pendingLens", () => ({
    type: "Lens",
    description: `Lens role for viewing a description of a generic dependency
        which is a pending promise. If the lens assigned to this role
        returns a promise then 'internalErrorLens' is displayed instead.

        @focus {Object} dependency  a description object of the pending dependency.`,
    isEnabled: true,
    rootValue: ({ delegate: [
      Valaa.Lens.loadingLens,
      <div {..._lensMessageLoadingProps}>
      <div {..._message}>Waiting for a pending dependency Promise to resolve.</div>
      <div {..._parameter}>
        <span {..._key}>Dependency:</span>
        <span {..._value}>{Valaa.Lens.focusDetailLens}</span>
      </div>
      {commonMessageRows}
      </div>
    ] }),
  }));

  createLensRoleSymbol("failedLens", () => ({
    type: "Lens",
    description: `Lens role for viewing a generic lens Promise failure.

        @focus {string|Error|Object} reason  a description of why the lens Promise failed.`,
    isEnabled: true,
    rootValue: ({ delegate: [
      Valaa.Lens.loadingFailedLens,
      <div {..._lensMessageInternalFailureProps}>
        <div {..._message}>
          Render Error: Lens Promise failed.
          {Valaa.Lens.toggleableErrorDetailLens}
        </div>
        <div {..._parameter}>
          <span {..._key}>Lens:</span>
          <span {..._value}>
            {Valaa.Lens.instrument(error => error.lens, Valaa.Lens.focusDetailLens)}
          </span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  createLensRoleSymbol("pendingConnectionsLens", () => ({
    type: "Lens",
    description: `Lens role for viewing a description of partition
        connection(s) that are being acquired.

        @focus {Object[]} partitions  the partition connection(s) that are being acquired.`,
    isEnabled: true,
    rootValue: ({ delegate: [
      Valaa.Lens.loadingLens,
      <div {..._lensMessageLoadingProps}>
        <div {..._message}>Acquiring partition connection(s).</div>
        <div {..._parameter}>
          <span {..._key}>Partitions:</span>
          <span {..._value}>{Valaa.Lens.focusDescriptionLens}</span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  createLensRoleSymbol("failedConnectionsLens", () => ({
    type: "Lens",
    description: `Lens role for viewing partition connection failure(s).

        @focus {string|Error|Object} reason  a description of why the connection failed.`,
    isEnabled: true,
    rootValue: ({ delegate: [
      Valaa.Lens.loadingFailedLens,
      <div {..._lensMessageInternalFailureProps}>
        <div {..._message}>
          Render Error: Optimistic Partition connection failed.
          {Valaa.Lens.toggleableErrorDetailLens}
        </div>
        <div {..._parameter}>
          <span {..._key}>Partition:</span>
          <span {..._value}>
            {Valaa.Lens.instrument(error => error.resource, Valaa.Lens.focusDescriptionLens)}
          </span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  createLensRoleSymbol("pendingActivationLens", () => ({
    type: "Lens",
    description: `Lens role for viewing a description of the focused
        resource that is pending activation.

        @focus {Object[]} resource  the resource that is being activated.`,
    isEnabled: true,
    rootValue: ({ delegate: [
      Valaa.Lens.loadingLens,
      <div {..._lensMessageLoadingProps}>
        <div {..._message}>Activating resource.</div>
        <div {..._parameter}>
          <span {..._key}>Resource:</span>
          <span {..._value}>{Valaa.Lens.focusDescriptionLens}</span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  createLensRoleSymbol("failedActivationLens", () => ({
    type: "Lens",
    description: `Lens role for viewing resource activation failure(s).

        @focus {string|Error|Object} reason  a description of why the resource activation failed.`,
    isEnabled: true,
    rootValue: ({ delegate: [
      Valaa.Lens.loadingFailedLens,
      <div {..._lensMessageInternalFailureProps}>
        <div {..._message}>
          Render Error: Resource activation failed.
          {Valaa.Lens.toggleableErrorDetailLens}
        </div>
        <div {..._parameter}>
          <span {..._key}>Resource:</span>
          <span {..._value}>
            {Valaa.Lens.instrument(error => error.resource, Valaa.Lens.focusDescriptionLens)}
          </span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));
  createLensRoleSymbol("inactiveLens", () => ({
    type: "Lens",
    description: `Lens role for viewing a focused inactive Resource.

        @focus {Object} focus  the inactive Resource focus.`,
    isEnabled: (focus?: Vrapper) => focus && focus.isInactive(),
    rootValue: ({ delegate: [
      Valaa.Lens.loadingFailedLens,
      <div {..._lensMessageLoadingFailedProps}>
        <div {..._message}>Focus {Valaa.Lens.focusDescriptionLens} is inactive.</div>
        <div {..._parameter}>
          <span {..._key}>Focus resource info:</span>
          <span {..._value}>{Valaa.Lens.focusDetailLens}</span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  createLensRoleSymbol("downloadingLens", () => ({
    type: "Lens",
    description: `Lens role for viewing a description of a focused
        Media whose content is being downloaded.

        @focus {Media} media  the Media being downloaded.`,
    isEnabled: true,
    rootValue: ({ delegate: [
      Valaa.Lens.loadingLens,
      <div {..._lensMessageLoadingProps}>
        <div {..._message}>Downloading dependency {Valaa.Lens.focusDetailLens}.</div>
        <div {..._parameter}>
          <span {..._key}>Of Media:</span>
          <span {..._value}>{Valaa.Lens.focusDetailLens}</span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  createLensRoleSymbol("pendingMediaInterpretationLens", () => ({
    type: "Lens",
    description: `Lens role for viewing a description of a focused
        Media which is being interpreted (ie. downloaded, decoded and
        integrated).

        @focus {Media} media  the Media being interpreted.`,
    isEnabled: true,
    rootValue: ({ delegate: [
      Valaa.Lens.loadingLens,
      <div {..._lensMessageLoadingProps}>
        <div {..._message}>Downloading dependency {Valaa.Lens.focusDetailLens}.</div>
        <div {..._parameter}>
          <span {..._key}>Of Media:</span>
          <span {..._value}>{Valaa.Lens.focusDetailLens}</span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  createLensRoleSymbol("failedMediaInterpretationLens", () => ({
    type: "Lens",
    description: `Lens role for viewing the focused failure on why
        a particular media interpretation could not be rendered.

        @focus {string|Error|Object} reason  interpretation render failure reason.`,
    isEnabled: true,
    rootValue: ({ delegate: [
      Valaa.Lens.loadingFailedLens,
      <div {..._lensMessageLoadingFailedProps}>
        <div {..._message}>
          Render Error: Failed to render Media interpretation.
          {Valaa.Lens.toggleableErrorDetailLens}
        </div>
        <div {..._parameter}>
          <span {..._key}>Of Media:</span>
          <span {..._value}>
            {Valaa.Lens.instrument(error => error.media, Valaa.Lens.focusDescriptionLens)}
          </span>
        </div>
        <div {..._parameter}>
          <span {..._key}>Interpretation info:</span>
          <span {..._value}>
            {Valaa.Lens.instrument(error => error.mediaInfo, Valaa.Lens.focusDetail)}
          </span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  createLensRoleSymbol("unrenderableMediaInterpretationLens", () => ({
    type: "Lens",
    description: `Lens role for viewing a focused media with an
        interpretation that cannot or should not be rendered (such as
        octet stream, complex native object or an undefined value).

        @focus {string|Error|Object} reason  interpretation render failure reason.`,
    isEnabled: true,
    rootValue: Valaa.Lens.failedMediaInterpretationLens,
  }));

  createLensRoleSymbol("mediaInterpretationErrorLens", () => ({
    type: "Lens",
    description: `Lens role for viewing a focused error that was
        encountered during media interpretation.

        @focus {string|Error|Object} reason  interpretation error.`,
    isEnabled: true,
    rootValue: Valaa.Lens.failedMediaInterpretationLens,
  }));

  createLensRoleSymbol("kueryingFocusLens", () => ({
    type: "Lens",
    description: `Lens role for viewing a component with an unfinished
        focus kuery.

        @focus {Object} focus  the focus kuery.`,
    isEnabled: (focus) => (focus === undefined),
    rootValue: ({ delegate: [
      Valaa.Lens.loadingLens,
      <div {..._lensMessageLoadingProps}>
        <div {..._message}>Waiting for focus kuery to complete.</div>
        <div {..._parameter}>
          <span {..._key}>Focus:</span>
          <span {..._value}>{Valaa.Lens.focusDetailLens}</span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  createLensRoleSymbol("kueryingPropsLens", () => ({
    type: "Lens",
    description: `Lens role for viewing a description of one or more
        unfinished props kueries.

        @focus {Object} props  the unfinished props kueries.`,
    isEnabled: true,
    rootValue: ({ delegate: [
      Valaa.Lens.loadingLens,
      <div {..._lensMessageLoadingProps}>
        <div {..._message}>Waiting for props kueries to complete.</div>
        <div {..._parameter}>
          <span {..._key}>Props kueries:</span>
          <span {..._value}>{Valaa.Lens.focusDetailLens}</span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  createLensRoleSymbol("pendingPropsLens", () => ({
    type: "Lens",
    description: `Lens role for viewing the description of props which
        are pending Promises.

        @focus {Object} props  the pending props Promises.`,
    isEnabled: true,
    rootValue: ({ delegate: [
      Valaa.Lens.loadingLens,
      <div {..._lensMessageLoadingProps}>
        <div {..._message}>Waiting for pending props Promise(s) to resolve.</div>
        <div {..._parameter}>
          <span {..._key}>Props promises:</span>
          <span {..._value}>{Valaa.Lens.focusDetailLens}</span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  createLensRoleSymbol("failedPropsLens", () => ({
    type: "Lens",
    description: `Lens role for viewing a props Promise failure.

        @focus {string|Error|Object} reason  props Promise failure reason.`,
    isEnabled: true,
    // TODO(iridian, 2019-02): Limit the props names to only the failing props.
    rootValue: ({ delegate: [
      Valaa.Lens.loadingFailedLens,
      <div {..._lensMessageInternalFailureProps}>
        <div {..._message}>
          Render Error: props Promise failure.
          {Valaa.Lens.toggleableErrorDetailLens}
        </div>
        <div {..._parameter}>
          <span {..._key}>Props (all) names:</span>
          <span {..._value}>
            {Valaa.Lens.instrument(error => error.propsNames, Valaa.Lens.focusDetailLens)}
          </span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  createLensRoleSymbol("pendingChildrenLens", () => ({
    type: "Lens",
    description: `Lens role for viewing a description of pending children Promise.

        @focus {Object} children  the pending children Promise.`,
    isEnabled: true,
    rootValue: ({ delegate: [
      Valaa.Lens.loadingLens,
      <div {..._lensMessageLoadingProps}>
        <div {..._message}>  Waiting for a pending children Promise to resolve.</div>
        <div {..._parameter}>
          <span {..._key}>Children:</span>
          <span {..._value}>{Valaa.Lens.focusDetailLens}</span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  createLensRoleSymbol("failedChildrenLens", () => ({
    type: "Lens",
    description: `Lens role for viewing a child Promise failure.

        @focus {string|Error|Object} reason  child Promise failure reason.`,
    isEnabled: true,
    // TODO(iridian, 2019-02): Add a grand-child path description to the errors.
    rootValue: ({ delegate: [
      Valaa.Lens.loadingFailedLens,
      <div {..._lensMessageInternalFailureProps}>
        <div {..._message}>
          Render Error: Child Promise failure.
          {Valaa.Lens.toggleableErrorDetailLens}
        </div>
        <div {..._parameter}>
          <span {..._key}>Children:</span>
          <span {..._value}>
            {Valaa.Lens.instrument(error => error.children, Valaa.Lens.focusDetailLens)}
          </span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  createLensRoleSymbol("activatingLens", () => ({
    type: "Lens",
    description: `Lens role for viewing an activating Resource.

        @focus {Object} focus  the activating Resource focus.`,
    isEnabled: (focus?: Vrapper) => focus && focus.isActivating(),
    rootValue: ({ delegate: [
      (focus, component) => {
        component.enqueueRerenderIfPromise(Promise
            .resolve(focus.activate())
            .then(() => undefined)); // undefined triggers re-render
        return undefined;
      },
      Valaa.Lens.loadingLens,
      <div {..._lensMessageLoadingProps}>
        <div {..._message}>Activating focus {Valaa.Lens.focusDescriptionLens}.</div>
        <div {..._parameter}>
          <span {..._key}>Focus resource info:</span>
          <span {..._value}>{Valaa.Lens.focusDetailLens}</span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  createLensRoleSymbol("inactiveLens", () => ({
    type: "Lens",
    description: `Lens role for viewing an inactive Resource.

        @focus {Object} focus  the inactive Resource focus.`,
    isEnabled: (focus?: Vrapper) => focus && focus.isInactive(),
    rootValue: ({ delegate: [
      Valaa.Lens.loadingFailedLens,
      <div {..._lensMessageLoadingFailedProps}>
        <div {..._message}>Focus {Valaa.Lens.focusDescriptionLens} is inactive.</div>
        <div {..._parameter}>
          <span {..._key}>Focus resource info:</span>
          <span {..._value}>{Valaa.Lens.focusDetailLens}</span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  createLensRoleSymbol("unavailableLens", () => ({
    type: "Lens",
    description: `Lens role for viewing an unavailable Resource.

        @focus {Object} focus  the unavailable Resource focus.`,
    isEnabled: (focus?: Vrapper) => focus && focus.isUnavailable(),
    rootValue: ({ delegate: [
      Valaa.Lens.loadingFailedLens,
      <div {..._lensMessageLoadingFailedProps}>
        <div {..._message}>Focus {Valaa.Lens.focusDescriptionLens} is unavailable.</div>
        <div {..._parameter}>
          <span {..._key}>Focus resource info:</span>
          <span {..._value}>{Valaa.Lens.focusDetailLens}</span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  createLensRoleSymbol("destroyedLens", () => ({
    type: "Lens",
    description: `Lens role for viewing a destroyed Resource.

        @focus {Object} focus  the destroyed Resource focus.`,
    isEnabled: (focus?: Vrapper) => focus && focus.isDestroyed(),
    rootValue: ({ delegate: [
      Valaa.Lens.loadingFailedLens,
      <div {..._lensMessageLoadingFailedProps}>
        <div {..._message}>Focus {Valaa.Lens.focusDescriptionLens} has been destroyed.</div>
        <div {..._parameter}>
          <span {..._key}>Focus resource info:</span>
          <span {..._value}>{Valaa.Lens.focusDetailLens}</span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  createLensRoleSymbol("lensPropertyNotFoundLens", () => ({
    type: "Lens",
    description: `Lens role for viewing a description of an active Resource
        focus which does not have a requested lens property.

        @focus {Object} focus  the active Resource focus.`,
    isEnabled: true,
    rootValue: ({ delegate: [
      Valaa.Lens.loadingFailedLens,
      <div {..._lensMessageLoadingFailedProps}>
        <div {..._message}>
          Cannot find a lens property from the active focus {Valaa.Lens.focusDescriptionLens}.
        </div>
        <div {..._parameter}>
          <span {..._key}>focusLensProperty:</span>
          <span {..._value}>
            {Valaa.Lens.instrument(Valaa.Lens.focusLensProperty, p => JSON.stringify(p))}
          </span>
        </div>
        <div {..._parameter}>
          <span {..._key}>lensProperty:</span>
          <span {..._value}>
            {Valaa.Lens.instrument(Valaa.Lens.lensProperty, p => JSON.stringify(p))}
          </span>
        </div>
        <div {..._parameter}>
          <span {..._key}>Focus detail:</span>
          <span {..._value}>{Valaa.Lens.focusDetailLens}</span>
        </div>
        <div {..._parameter}>
          <span {..._key}>Focus properties:</span>
          <span {..._value}>
            {Valaa.Lens.instrument(Valaa.Lens.propertyKeysLens, p => JSON.stringify(p))}
          </span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  createLensRoleSymbol("notLensResourceLens", () => ({
    type: "Lens",
    description: `Lens role for viewing a Resource which cannot be used as a lens.

        @focus {Object} nonLensResource  the non-lens-able Resource.`,
    isEnabled: true,
    rootValue: ({ delegate: [
      Valaa.Lens.loadingFailedLens,
      <div {..._lensMessageLoadingFailedProps}>
        <div {..._message}>
          Resource {Valaa.Lens.focusDescriptionLens} cannot be used as a lens.
          This is because it is not a valid lens Media file and it does not have a lens property
          that is listed in either delegateLensProperty or lensProperty roles.
        </div>
        <div {..._parameter}>
          <span {..._key}>delegateLensProperty:</span>
          <span {..._value}>
            {Valaa.Lens.instrument(Valaa.Lens.delegateLensProperty, p => JSON.stringify(p))}
          </span>
        </div>
        <div {..._parameter}>
          <span {..._key}>lensProperty:</span>
          <span {..._value}>
            {Valaa.Lens.instrument(Valaa.Lens.lensProperty, p => JSON.stringify(p))}
          </span>
        </div>
        <div {..._parameter}>
          <span {..._key}>Resource detail:</span>
          <span {..._value}>{Valaa.Lens.focusDetailLens}</span>
        </div>
        <div {..._parameter}>
          <span {..._key}>Resource properties:</span>
          <span {..._value}>
            {Valaa.Lens.instrument(Valaa.Lens.propertyKeysLens, p => JSON.stringify(p))}
          </span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  createLensRoleSymbol("arrayNotIterableLens", () => ({
    type: "Lens",
    description: `Lens role for viewing an valaaScope props.array which is not
        an iterable.

        @focus {Object} nonArray  the non-iterable value.`,
    isEnabled: true,
    rootValue: ({ delegate: [
      Valaa.Lens.loadingFailedLens,
      <div {..._lensMessageLoadingFailedProps}>
        <div {..._message}>props.array {Valaa.Lens.focusDescriptionLens} is not an iterable.</div>
        <div {..._parameter}>
          <span {..._key}>props.array:</span>
          <span {..._value}>{Valaa.Lens.focusDetailLens}</span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  createLensRoleSymbol("invalidElementLens", () => ({
    type: "Lens",
    description: `Lens role for viewing an a description of an invalid UI element.

        @focus {Object} description  string or object description.`,
    isEnabled: true,
    rootValue: ({ delegate: [
      Valaa.Lens.loadingFailedLens,
      <div {..._lensMessageLoadingFailedProps}>
        <div {..._message}>
            {Valaa.Lens.instrument(
                Valaa.Lens.parentComponentLens, Valaa.Lens.focusDetailLens)}
            returned an invalid element.
        </div>
        <div {..._parameter}>
          <span {..._key}>Faults:</span>
          <span {..._value}>{Valaa.Lens.focusDumpLens}</span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  finalizeLensDescriptors();
  return Valaa.Lens;
}
