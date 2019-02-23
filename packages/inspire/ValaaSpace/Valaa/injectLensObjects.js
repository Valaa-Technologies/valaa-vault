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

export default function injectLensObjects (Valaa: Object, rootScope: Object,
    hostObjectDescriptors: Object) {
  Valaa.Lens = {};
  const lensDescriptorOptions: { [string]: {} } = {};
  function createLensRoleSymbol (name: string, type: string, description: string,
      isLensAvailable: any, defaultLensThunk: any) {
    lensDescriptorOptions[name] = { name, type, description, isLensAvailable, defaultLensThunk };
    Valaa.Lens[name] = Symbol(name);
    Valaa.Lens[Valaa.Lens[name]] = name;
    return Valaa.Lens[name];
  }
  function finalizeLensDescriptors () {
    const lensDescriptors = {};
    Object.entries(lensDescriptorOptions).forEach(
        ([lensRoleName, { value, type, description, isLensAvailable, defaultLensThunk }]) => {
          const descriptor = {
            valaa: true, symbol: true,
            value, type, description,
            writable: false, enumerable: true, configurable: false,
          };
          if (typeof isLensAvailable !== "undefined") {
            Object.assign(descriptor, { lensRole: true, isLensAvailable });
          }
          lensDescriptors[lensRoleName] = Object.freeze(descriptor);
          hostObjectDescriptors.set(Valaa.Lens[lensRoleName], descriptor);
          if (defaultLensThunk) {
            rootScope[Valaa.Lens[lensRoleName]] = defaultLensThunk();
          }
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

  createLensRoleSymbol("activeViewRoles",
      "string[]",
      `Lens role for viewing the names of the lens roles that are
      currently active in viewing content.`,
  );

  const niceActiveRoleNames = Valaa.Lens.instrument(
      Valaa.Lens.activeViewRoles,
      roleNames => roleNames.slice(0, -1).reverse().join(" <- "));

  createLensRoleSymbol("componentChildrenLens",
      "any[]",
      `Lens role for viewing the child elements of the current parent
      component.`,
      (u: any, component: UIComponent) => arrayFromAny(component.props.children).length,
      () => (u: any, component: UIComponent) => component.props.children
  );

  createLensRoleSymbol("parentComponentLens",
      "any[]",
      `Lens role for viewing the parent component itself.
      This role is typically used in conjunction with some other role
      like 'focusDetailLens'.`,
      true,
      () => (u: any, component: UIComponent) => component
  );

  createLensRoleSymbol("focusDescriptionLens",
      "Lens",
      `Lens role for viewing a brief description of the focus.

      @param {any} focus  the focus to describe.`,
      true,
      () => (function renderFocusDescription (focus: any, component: UIComponent) {
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
      })
  );

  createLensRoleSymbol("focusDetailLens",
      "Lens",
      `Lens role for viewing a developer-oriented debug introspection
      of the focus.

      @param {any} focus  the focus to describe.`,
      true,
      () => (focus: any) => debugId(focus),
  );

  createLensRoleSymbol("focusDumpLens",
      "Lens",
      `Lens role for viewing a full string dump of the focus. Replaces
      circular/duplicates with tags.

      @param {any} focus  the focus to dump.`,
      true,
      () => (focus: any) => dumpify(focus, { indent: 2 }),
  );

  createLensRoleSymbol("focusPropertyKeysLens",
      "Lens",
      `Lens role for viewing the list of property keys of the focus.

      @param {any} focus  the focus to describe.`,
      (focus) => focus && (typeof focus === "object"),
      () => (focus: any) => (!focus || (typeof focus !== "object")
          ? undefined
          : Object.keys(!(focus instanceof Vrapper) ? focus : focus.getLexicalScope())),
  );

  createLensRoleSymbol("internalErrorLens",
      "Lens",
      `A catch-all lens role for viewing an internal error, such
      as an unhandled exception or if a 'pendingLens' returns a
      promise.
      By default displays the yelling-red screen.

      @param {string|Error} error  the failure description or exception object`,
      true,
      () => function renderInternalFailure () {
        return (
          <div {..._lensMessageInternalFailureProps}>
            Render Error: Component has internal error(s).
            {Valaa.Lens.toggleableErrorDetailLens}
          </div>
        );
      }
  );

  createLensRoleSymbol("toggleableErrorDetailLens",
      "Lens",
      `A catch-all lens role for rendering detailed, toggleable error
      view.

      @param {string|Error} error  the failure description or exception object`,
      true,
      () => function renderToggleableErrorDetail (failure: string | Error, component: UIComponent) {
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
      }
  );

  // Main component lifecycle lens

  createLensRoleSymbol("valaaScopeLens",
      "Lens",
      `Lens role for viewing a ValaaScope component.

      @param {string|Error|Object} focus  the focus of the component`,
      true,
      () => ({ delegate: [
        Valaa.Lens.firstAbleDelegateLens,
        Valaa.Lens.disabledLens,
        Valaa.Lens.unframedLens,
        Valaa.Lens.instanceLens,
        Valaa.Lens.undefinedLens,
        Valaa.Lens.lens,
        Valaa.Lens.nullLens,
        Valaa.Lens.componentChildrenLens,
        Valaa.Lens.resourceLens,
        Valaa.Lens.loadedLens,
      ] }),
  );

  createLensRoleSymbol("livePropsLens",
      "Lens",
      `Lens role for viewing a LiveProps component.

      @param {string|Error|Object} focus  the focus of the component`,
      true,
      () => ({ delegate: [
        Valaa.Lens.firstAbleDelegateLens,
        Valaa.Lens.disabledLens,
        Valaa.Lens.undefinedLens,
        Valaa.Lens.loadedLens,
      ] }),
  );

  createLensRoleSymbol("uiComponentLens",
      "Lens",
      `Lens role for viewing a UIComponent component.

      @param {string|Error|Object} focus  the focus of the component`,
      true,
      () => ({ delegate: [
        Valaa.Lens.firstAbleDelegateLens,
        Valaa.Lens.disabledLens,
        Valaa.Lens.undefinedLens,
        Valaa.Lens.loadedLens,
      ] }),
  );


  createLensRoleSymbol("firstAbleDelegateLens",
      "Lens",
      `Lens role for viewing a component via its first able
      props.delegate.

      @param {string|Error|Object} focus  the focus of the component`,
      (u, component) => (component.props.delegate !== undefined),
      () => (focus, component, lensName = "delegate") =>
          component.renderFirstAbleDelegate(component.props.delegate, focus, lensName),
  );

  createLensRoleSymbol("loadedLens",
      "Lens",
      `Lens role for viewing component using its .renderLoaded method.

      @param {string|Error|Object} focus  the focus of the component`,
      true,
      () => (focus, component) => component.renderLoaded(focus),
  );

  // Content lenses

  createLensRoleSymbol("undefinedLens",
      "Lens",
      `Lens role for viewing an undefined focus.`,
      (focus) => (focus === undefined),
      () => ({ delegate: [
        Valaa.Lens.instrument(
            (u, component) => (component.props.kuery || component.props.focus),
            Valaa.Lens.kueryingFocusLens),
      ] }),
  );

  createLensRoleSymbol("nullLens",
      "Lens",
      `Lens role for viewing a null focus.`,
      (focus) => (focus === null),
      () => "");

  createLensRoleSymbol("lens",
      "Lens",
      `Lens role for viewing a loaded component.

      @param {Object} focus  the focus of the component.`,
      true,
      () => undefined);

  createLensRoleSymbol("resourceLens",
      "Lens",
      `Lens role for viewing a Resource focus.

      @param {Object} focus  the Resource focus.`,
      (focus?: Vrapper) => (focus instanceof Vrapper) && (focus.activate() || true),
      () => ({ delegate: [
        Valaa.Lens.activeLens,
        Valaa.Lens.activatingLens,
        Valaa.Lens.inactiveLens,
        Valaa.Lens.destroyedLens,
        Valaa.Lens.unavailableLens,
      ] }));

  createLensRoleSymbol("activeLens",
      "Lens",
      `Lens role for viewing an active Resource focus.

      @param {Object} focus  the active Resource focus.`,
      (focus?: Vrapper) => focus && focus.isActive(),
      () => Valaa.Lens.focusPropertyLens);

  createLensRoleSymbol("lensProperty",
      "(string | string[])",
      `Lens role for the name or array of property names that are
      searched from a Resource when looking for a property lens.
      This role is shared by all property lenses.`);

  _createLensPropertyRoles("focusLensProperty", ["FOCUS_LENS"],
      "focusPropertyLens", "lensPropertyNotFoundLens");
  _createLensPropertyRoles("delegateLensProperty", ["DELEGATE_LENS"],
      "delegatePropertyLens", "notLensResourceLens");

  function _createLensPropertyRoles (lensPropertyRoleName, defaultLensNames, propertyLensRoleName,
      notFoundName) {
    const roleSymbol = createLensRoleSymbol(lensPropertyRoleName,
        "(string | string[])",
        `Lens role for the name or array of property names that are
        searched from the Resource focus when resolving the
        *${propertyLensRoleName}* role.`,
        undefined,
        () => defaultLensNames,
    );

    createLensRoleSymbol(propertyLensRoleName,
        "Lens",
        `Lens role for retrieving a lens from a property of a Resource.
        By default retrieves a property with the name specified by
        props.${lensPropertyRoleName} or
        context[Valaa.Lens.${lensPropertyRoleName}] from the focus.
        If not found, falls back to searching property with name
        props.lensProperty or context[Valaa.Lens.lensProperty] from the
        focus.
        The props/context property name can also be an array, in which
        case the first matching lens is returned.

        If still no suitable lens can be found delegates the display to
        '${notFoundName || "null"}'.

        @param {Object} focus  the Resource to search the lens from.`,
        (focus?: Vrapper) => focus && focus.hasInterface("Scope"),
        () => function propertyLensRoleNameGetter (focus: any, component: UIComponent,
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
          // Deprecated.
          component.props.lensName || [],
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
              component.attachKuerySubscriber(`props.${lensPropertyRoleName}-${lensRoleName}`,
                  vProperty, "value", {
                    scope: component.getUIContext(),
                    noImmediateRun: true,
                    onUpdate: () => component.forceUpdate(),
                  });
              return vProperty.extractValue();
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
        });
  }

  // ValaaScope lenses

  createLensRoleSymbol("scopeChildren",
      "any",
      `The child element(s) of the innermost enclosing ValaaScope-like
      parent component.`,
  );

  // Instance lenses

  createLensRoleSymbol("unframedLens",
      "Lens",
      `Lens role for viewing a ValaaScope which has not yet loaded its
      lens frame.`,
    (focus, component) => !component.state || (component.state.scopeFrame === undefined),
    () => "<Loading frame...>",
  );

  createLensRoleSymbol("instanceLens",
      "Lens",
      `Lens role for viewing the focus through an instance lens.`,
      (focus, component) => component.props.instanceLensPrototype,
      () => (focus, component, lensRoleName) => thenChainEagerly(
          component.state.scopeFrame, [
            (scopeFrame => {
              if ((scopeFrame == null) || !(scopeFrame instanceof Vrapper)) return "";
              if (!scopeFrame.hasInterface("Scope")) return scopeFrame;
              const instanceRoleName = `instance-${lensRoleName}`;
              const instanceLens = component.getUIContextValue(Valaa.Lens.instancePropertyLens)(
                  scopeFrame, component, instanceRoleName);
              return (instanceLens != null) ? instanceLens : scopeFrame;
            }),
          ]),
  );

  _createLensPropertyRoles("instanceLensProperty", ["INSTANCE_LENS"], "instancePropertyLens");

  createLensRoleSymbol("instanceLensPrototype",
      "Resource",
      `Lens frame prototype Resource. Only valid when given as component props.`);

  createLensRoleSymbol("scopeFrameResource",
      "Resource",
      `Current innermost enclosing scope frame which is also
      a Resource. Used as the owner for any scope frames created for
      any of its child components.`);

  createLensRoleSymbol("obtainScopeFrame",
      "(prototype: Resource, owner: Resource, focus: any, lensName: string): Resource",
      `Returns an existing or creates a new Resource or object to be
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
      undefined,
      () => (prototype: Vrapper, owner: Vrapper, focus: any, lensName: string = "",
          component: UIComponent) => {
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
      });

  createLensRoleSymbol("lensAuthorityProperty",
      "(string)",
      `Lens role for a property name that is used when searching for an
      authority URI string.
      This property will be searched for from a lens instance prototype
      or a Resource focus when obtaining a lens frame. If found the
      authority URI will be used for the lens partition. If the
      partition didn't already exist new lens partition is created in
      that authority URI with a new scope frame resource as its
      partition root.`,
      undefined,
      () => "LENS_AUTHORITY",
  );

  createLensRoleSymbol("shadowLensPartitionRoot",
      "(Resource | null)",
      `Lens role for resource which is the root resource of a shadow
      lens partition. A shadow lens partition is a partition which was
      created to contain lens state for a particular focus resource
      (which is found in Valaa.Lens.shadowedFocus).`,
  );

  createLensRoleSymbol("shadowedFocus",
      "(Resource | null)",
      `Lens role for a partition that is being shadowed by a shadow
      lens partition (which is found in
      Valaa.Lens.shadowLensPartitionRoot). This role is used to detect
      if a particular focus is already being shadowed in which case no
      new shadow partition will needlessly be created.`,
  );

  createLensRoleSymbol("shadowLensAuthority",
      "(string | null)",
      `Lens role for the default lens authority URI for scope frames
      which have a partition root Resource as their focus. Used when
      a lens authority is not defined via other means, such as
      an explicit instance or focus lens authority property.`,
      undefined,
      () => "valaa-memory:",
  );

  // User-definable catch-all lenses

  createLensRoleSymbol("loadingLens",
      "Lens",
      `A catch-all lens role for viewing a description of a
      dependency which is still being loaded.
      Unassigned by default; assign a lens to this role to have all the
      *default* implementations of all other loading -like roles
      delegate to this role (instead of using their own default lens).

      @param {Object} component  an object description of the dependency being loaded`
  );

  createLensRoleSymbol("loadingFailedLens",
      "Lens",
      `A catch-all lens role for viewing a description of a
      dependency which has failed to load.
      Unassigned by default; assign a lens to this role to have all the
      *default* implementations of all other loading-failed -like roles
      delegate to this role (instead of using their own default lens).

      @param {string|Error|Object} reason  the explanation of the loading failure`
  );

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

  createLensRoleSymbol("disabledLens",
      "Lens",
      `Lens role for viewing an explicitly disabled component.

      @param {string|Error|Object} reason  a description of why the component is disabled.`,
      (u, component) => ((component.state || {}).uiContext === undefined),
      () => ({ delegate: [
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
  );

  createLensRoleSymbol("pendingLens",
      "Lens",
      `Lens role for viewing a description of a generic dependency
      which is a pending promise. If the lens assigned to this role
      returns a promise then 'internalErrorLens' is displayed instead.

      @param {Object} dependency  a description object of the pending dependency.`,
      true,
      () => ({ delegate: [
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
  );

  createLensRoleSymbol("failedLens",
      "Lens",
      `Lens role for viewing a generic lens Promise failure.

      @param {string|Error|Object} reason  a description of why the lens Promise failed.`,
      true,
      () => ({ delegate: [
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
  );

  createLensRoleSymbol("pendingConnectionsLens",
      "Lens",
      `Lens role for viewing a description of partition connection(s)
      that are being acquired.

      @param {Object[]} partitions  the partition connection(s) that are being acquired.`,
      true,
      () => ({ delegate: [
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
  );

  createLensRoleSymbol("failedConnectionsLens",
      "Lens",
      `Lens role for viewing partition connection failure(s).

      @param {string|Error|Object} reason  a description of why the connection failed.`,
      true,
      () => ({ delegate: [
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
  );

  createLensRoleSymbol("pendingActivationLens",
      "Lens",
      `Lens role for viewing a description of pending resource activation.

      @param {Object[]} resource  the resource that is being activated.`,
      true,
      () => ({ delegate: [
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
  );

  createLensRoleSymbol("failedActivationLens",
      "Lens",
      `Lens role for viewing resource activation failure(s).

      @param {string|Error|Object} reason  a description of why the resource activation failed.`,
      true,
      () => ({ delegate: [
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
  );
  createLensRoleSymbol("inactiveLens",
      "Lens",
      `Lens role for viewing an inactive Resource.

      @param {Object} focus  the inactive Resource focus.`,
      (focus?: Vrapper) => focus && focus.isInactive(),
      () => ({ delegate: [
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
  );

  createLensRoleSymbol("downloadingLens",
      "Lens",
      `Lens role for viewing a description of Media dependency whose
      content is being downloaded.

      @param {Media} media  the Media being downloaded.`,
      true,
      () => ({ delegate: [
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
  );

  createLensRoleSymbol("pendingMediaInterpretationLens",
      "Lens",
      `Lens role for viewing a description of Media dependency which
      is being interpreted: downloaded, decoded and integrated.

      @param {Media} media  the Media being interpreted.`,
      true,
      () => ({ delegate: [
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
  );

  createLensRoleSymbol("failedMediaInterpretationLens",
      "Lens",
      `Lens role for viewing a media interpretation failure.

      @param {string|Error|Object} reason  interpretation failure reason.`,
      true,
      () => ({ delegate: [
        Valaa.Lens.loadingFailedLens,
        <div {..._lensMessageInternalFailureProps}>
          <div {..._message}>
            Render Error: Media interpretation failed.
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
  );

  createLensRoleSymbol("kueryingFocusLens",
      "Lens",
      `Lens role for viewing a component with an unfinished focus kuery.

      @param {Object} focus  the focus kuery.`,
      (focus) => (focus === undefined),
      () => ({ delegate: [
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
  );

  createLensRoleSymbol("kueryingPropsLens",
      "Lens",
      `Lens role for viewing a description of one or more unfinished props kueries.

      @param {Object} props  the unfinished props kueries.`,
      true,
      () => ({ delegate: [
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
  );

  createLensRoleSymbol("pendingPropsLens",
      "Lens",
      `Lens role for viewing the description of props which are pending Promises.

      @param {Object} props  the pending props Promises.`,
      true,
      () => ({ delegate: [
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
  );

  createLensRoleSymbol("failedPropsLens",
      "Lens",
      `Lens role for viewing a props Promise failure.

      @param {string|Error|Object} reason  props Promise failure reason.`,
      true,
      // TODO(iridian, 2019-02): Filter the props names to only the
      // failing props.
      () => ({ delegate: [
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
  );

  createLensRoleSymbol("pendingChildrenLens",
      "Lens",
      `Lens role for viewing a description of pending children Promise.

      @param {Object} children  the pending children Promise.`,
      true,
      () => ({ delegate: [
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
  );

  createLensRoleSymbol("failedChildrenLens",
      "Lens",
      `Lens role for viewing a child Promise failure.

      @param {string|Error|Object} reason  child Promise failure reason.`,
      true,
      // TODO(iridian, 2019-02): Add a grand-child path description to
      // the errors.
      () => ({ delegate: [
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
  );

  createLensRoleSymbol("activatingLens",
      "Lens",
      `Lens role for viewing an activating Resource.

      @param {Object} focus  the activating Resource focus.`,
      (focus?: Vrapper) => focus && focus.isActivating(),
      () => ({ delegate: [
        (focus, component) => {
          component.enqueueRerenderIfPromise(Promise.resolve(focus.activate()));
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
  );

  createLensRoleSymbol("inactiveLens",
      "Lens",
      `Lens role for viewing an inactive Resource.

      @param {Object} focus  the inactive Resource focus.`,
      (focus?: Vrapper) => focus && focus.isInactive(),
      () => ({ delegate: [
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
  );

  createLensRoleSymbol("unavailableLens",
      "Lens",
      `Lens role for viewing an unavailable Resource.

      @param {Object} focus  the unavailable Resource focus.`,
      (focus?: Vrapper) => focus && focus.isUnavailable(),
      () => ({ delegate: [
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
  );

  createLensRoleSymbol("destroyedLens",
      "Lens",
      `Lens role for viewing a destroyed Resource.

      @param {Object} focus  the destroyed Resource focus.`,
      (focus?: Vrapper) => focus && focus.isDestroyed(),
      () => ({ delegate: [
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
  );

  createLensRoleSymbol("lensPropertyNotFoundLens",
      "Lens",
      `Lens role for viewing a description of an active Resource
      focus which does not have a requested lens property.

      @param {Object} focus  the active Resource focus.`,
      true,
      () => ({ delegate: [
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
  );

  createLensRoleSymbol("notLensResourceLens",
      "Lens",
      `Lens role for viewing a Resource which cannot be used as a lens.

      @param {Object} nonLensResource  the non-lens-able Resource.`,
      true,
      () => ({ delegate: [
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
  );

  createLensRoleSymbol("arrayNotIterableLens",
      "Lens",
      `Lens role for viewing an valaaScope props.array which is not
      an iterable.

      @param {Object} nonArray  the non-iterable value.`,
      true,
      () => ({ delegate: [
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
  );

  createLensRoleSymbol("invalidElementLens",
      "Lens",
      `Lens role for viewing an a description of an invalid UI element.

      @param {Object} description  string or object description.`,
      true,
      () => ({ delegate: [
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
  );


/*
  createLensRoleSymbol("fixedLens",
      "Lens",
      `DEPRECATED; prefer Valaa.Lens.lens.`,
      true,
      () => undefined);
*/
  createLensRoleSymbol("fallbackLens",
      "Lens",
      `DEPRECATED; prefer lensPropertyNotFoundLens.`,
      true,
      () => (focus: any, component: UIComponent) => {
        console.error("DEPRECATED: Valaa.Lens.fallbackLens",
            "\n\tprefer: Valaa.Lens.lensPropertyNotFoundLens",
            "\n\tin component:", component.debugId(), component);
        return Valaa.Lens.lensPropertyNotFoundLens;
      });

  finalizeLensDescriptors();
  return Valaa.Lens;
}
