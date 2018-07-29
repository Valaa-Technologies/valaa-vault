// @flow

import React from "react";

import { denoteValaaBuiltinWithSignature } from "~/raem/VALK";

import Vrapper from "~/engine/Vrapper";
import UIComponent from "~/inspire/ui/UIComponent";

import { arrayFromAny, messageFromError } from "~/tools";

export default function injectLensObjects (Valaa: Object, rootScope: Object,
    hostObjectDescriptors: Object) {
  Valaa.Lens = {};
  const lensDescriptorOptions: { [string]: {} } = {};
  function createLensRoleSymbol (name: string, type: string, description: string,
      isLensAvailable: any, defaultLensThunk: any) {
    lensDescriptorOptions[name] = { name, type, description, isLensAvailable, defaultLensThunk };
    Valaa.Lens[name] = Symbol(name);
    Valaa.Lens[Valaa.Lens[name]] = name;
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
  const _parameters = { className: `${_element} ${_element}_parameter` };
  const _lensChain = { className: `${_element} ${_element}_lensChain` };
  const _component = { className: `${_element} ${_element}_component` };
  const _key = { className: `inspire__lensMessage-infoKey` };
  const _value = { className: `inspire__lensMessage-infoValue` };

  Valaa.instrument = denoteValaaBuiltinWithSignature(
      `function(lens1[, lens2[, ...[, lensN]]])
      Creates an _instrument lens_ by chaining multiple lenses in
      sequence. When an instrument lens is assigned into a lens role
      the instrument passes its focus to the first lens. Then it
      forwards the output of the first lens to the second lens and so
      on until the output of the last lens is displayed as the output
      of the instrument lens itself.`
  // eslint-disable-next-line
  )(function instrument (...lenses) {
    return (focus: any, component: UIComponent, lensName: string) =>
      lenses.reduce((refraction, lens) =>
            component.renderLens(lens, refraction, lensName), focus);
  });

  // Primitive lenses

  createLensRoleSymbol("activeRoles",
      "string[]",
      `Lens role for displaying the names of the lens roles that are
      currently active in displaying content.`,
  );

  const niceActiveRoleNames = Valaa.instrument(
      Valaa.Lens.activeRoles,
      roleNames => roleNames.slice(0, -1).reverse().join(" <- "));

  createLensRoleSymbol("childrenLens",
      "any[]",
      `Lens role for displaying the child elements of the containing
      component.`,
      true,
      () => (focus: any, component: UIComponent) => component.props.children
  );

  createLensRoleSymbol("describeFocusLens",
      "Lens",
      `Lens role for displaying a brief description of the current focus.

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

  createLensRoleSymbol("debugFocusLens",
      "Lens",
      `Lens role for displaying a developer-oriented information of the
      current focus.

      @param {any} focus  the focus to describe.`,
      true,
      () => (function renderFocusDebug (focus: any, component: UIComponent) {
        switch (typeof focus) {
          case "string":
            return `<string "${focus.length <= 60 ? focus : `${focus.slice(0, 57)}...`}">`;
          case "function":
            return `<function ${focus.name}>`;
          case "object": {
            if (focus !== null) {
              if (focus instanceof Vrapper) return `<${focus.debugId()}>`;
              if (Array.isArray(focus)) {
                return `[${focus.map(entry => renderFocusDebug(entry, component)).join(", ")}]`;
              }
              return `<object { ${Object.keys(focus).join(", ")} }>`;
            }
          }
          // eslint-disable-next-line no-fallthrough
          default:
            return `<${typeof focus} ${JSON.stringify(focus)}>`;
        }
      })
  );

  createLensRoleSymbol("describeComponentLens",
      "Lens",
      `Lens role for displaying a developer-oriented description of the
      current component.`,
      true,
      () => (function renderComponentDescription (unused: any, component: UIComponent) {
        return component.debugId();
      }),
  );

  createLensRoleSymbol("internalErrorLens",
      "Lens",
      `A catch-all lens role for displaying an internal error, such
      as an unhandled exception or if a 'pendingLens' returns a
      promise.
      By default displays the yelling-red screen.

      @param {string|Error} error  the failure description or exception object`,
      true,
      () => function renderInternalFailure (failure: string | Error, component: UIComponent) {
        return (
          <div {..._lensMessageInternalFailureProps}>
            <p>
              There is an error with component:
              <button onClick={component.toggleError}>
                {component.state.errorHidden ? "Show" : "Hide"}
              </button>
              <button onClick={component.clearError}>
                Clear
              </button>
            </p>
            {!component.state.errorHidden
                ? <pre style={{ fontFamily: "monospace" }}>{
                    `${messageFromError(failure)}`
                  }</pre>
                : null}
          </div>
        );
      }
  );


  // Content lenses

  createLensRoleSymbol("lens",
      "Lens",
      `Lens role for displaying a loaded component.

      @param {Object} focus  the focus of the component.`,
      true,
      () => undefined);

  createLensRoleSymbol("nullLens",
      "Lens",
      `Lens role for displaying a null focus.`,
      (focus?: Vrapper) => (focus === null),
      () => null);

  createLensRoleSymbol("resourceLens",
      "Lens",
      `Lens role for displaying a Resource focus of a loaded component.

      @param {Object} focus  the Resource focus.`,
      (focus?: Vrapper) => (focus instanceof Vrapper),
      () => ({ overrideLens: [
        Valaa.Lens.activeLens,
        Valaa.Lens.activatingLens,
        Valaa.Lens.inactiveLens,
        Valaa.Lens.destroyedLens,
        Valaa.Lens.unavailableLens,
      ] }));

  createLensRoleSymbol("activeLens",
      "Lens",
      `Lens role for displaying an active Resource focus of a loaded
      component.

      @param {Object} focus  the active Resource focus.`,
      (focus?: Vrapper) => focus && focus.isActive(),
      () => Valaa.Lens.lensPropertyLens);

  createLensRoleSymbol("lensPropertyLens",
      "Lens",
      `Lens role for displaying an active Resource focus using one of
      its own properties as the lens. By default retrieves
      'lensProperty' from props or 'Valaa.Lens.lensProperty' from
      context and then searches the focus for a matching property.
      If lensProperty is an array the first matching property from
      focus is used.
      If 'lensProperty' itself or no matching property can be found
      falls back to 'lensPropertyNotFoundLens'.

      @param {Object} focus  the active Resource focus.`,
      (focus?: Vrapper) => focus && focus.hasInterface("Scope"),
      () => function renderPropertyLens (focus: any, component: UIComponent) {
        const props = component.props;
        const lensProperty = props.lensProperty || props.lensName
            || component.getUIContextValue(Valaa.Lens.lensProperty)
            || component.context.lensProperty;
        if (lensProperty) {
          const focusLexicalScope = focus.getLexicalScope();
          for (const propertyName of arrayFromAny(lensProperty)) {
            if (focusLexicalScope.hasOwnProperty(propertyName)) {
              return focusLexicalScope[propertyName].extractValue();
            }
          }
        }
        return {
          overrideLens: [Valaa.Lens.lensPropertyNotFoundLens],
        };
      });

  createLensRoleSymbol("lensProperty",
      "(string | string[])",
      `Lens role for the name or array of property names that are
      searched from an active Resource focus when displaying the
      *propertyLens* role.`);


  // User-definable catch-all lenses

  createLensRoleSymbol("loadingLens",
      "Lens",
      `A catch-all lens role for displaying a description of a
      dependency which is still being loaded.
      Unassigned by default; assign a lens to this role to have all the
      *default* implementations of all other loading -like roles
      delegate to this role (instead of using their own default lens).

      @param {Object} component  an object description of the dependency being loaded`
  );

  createLensRoleSymbol("loadingFailedLens",
      "Lens",
      `A catch-all lens role for displaying a description of a
      dependency which has failed to load.
      Unassigned by default; assign a lens to this role to have all the
      *default* implementations of all other loading-failed -like roles
      delegate to this role (instead of using their own default lens).

      @param {string|Error|Object} reason  the explanation of the loading failure`
  );

  // Failure and lifecycle lenses

  const commonMessageRows = [
    <div {..._lensChain}>
      <span {..._key}>Lens role delegation:</span>
      <span {..._value}>{niceActiveRoleNames}</span>
    </div>,
    <div {..._component}>
      <span {..._key}>Containing component:</span>
      <span {..._value}>{Valaa.Lens.describeComponentLens}</span>
    </div>,
  ]

  createLensRoleSymbol("disabledLens",
      "Lens",
      `Lens role for displaying the reason why a component is
      explicitly disabled.

      @param {string|Error|Object} reason  a description of why the component is disabled.`,
      true,
      () => ({ overrideLens: [
        Valaa.Lens.loadingFailedLens,
        <div {..._lensMessageLoadingFailedProps}>
          <div {..._message}>Component is disabled; focus and context are not available.</div>
          <div {..._parameters}>
            <span {..._key}>Disable reason:</span>
            <span {..._value}>{Valaa.Lens.debugFocusLens}</span>
          </div>
          {commonMessageRows}
        </div>
      ] })
  );

  createLensRoleSymbol("pendingLens",
      "Lens",
      `Lens role for displaying a description of a dependency which is
      a pending promise. If the lens assigned to this role returns a
      promise then 'internalErrorLens' is displayed instead.

      @param {Object} dependency  a description object of the pending dependency.`,
      true,
      () => ({ overrideLens: [
        Valaa.Lens.loadingLens,
        <div {..._lensMessageLoadingProps}>
        <div {..._message}>Waiting for a pending dependency Promise to resolve.</div>
        <div {..._parameters}>
          <span {..._key}>Dependency:</span>
          <span {..._value}>{Valaa.Lens.debugFocusLens}</span>
        </div>
        {commonMessageRows}
        </div>
      ] })
  );

  createLensRoleSymbol("connectingLens",
      "Lens",
      `Lens role for displaying a description of partition connections
      that are being acquired.

      @param {Object[]} partitions  the partition connections that are being acquired.`,
      true,
      () => ({ overrideLens: [
        Valaa.Lens.loadingLens,
        <div {..._lensMessageLoadingProps}>
          <div {..._message}>Acquiring partition connection(s).</div>
          <div {..._parameters}>
            <span {..._key}>Partitions:</span>
            <span {..._value}>{Valaa.Lens.describeFocusLens}</span>
          </div>
          {commonMessageRows}
        </div>
      ] })
  );

  createLensRoleSymbol("downloadingLens",
      "Lens",
      `Lens role for displaying a description of Media dependency whose
      content is being downloaded.

      @param {Media} media  the Media being downloaded.`,
      true,
      () => ({ overrideLens: [
        Valaa.Lens.loadingLens,
        <div {..._lensMessageLoadingProps}>
          <div {..._message}>Downloading dependency {Valaa.Lens.debugFocusLens}.</div>
          <div {..._parameters}>
            <span {..._key}>Media:</span>
            <span {..._value}>{Valaa.Lens.debugFocusLens}</span>
          </div>
          {commonMessageRows}
        </div>
      ] })
  );

  createLensRoleSymbol("kueryingFocusLens",
      "Lens",
      `Lens role for displaying a description of an unfinished focus kuery.

      @param {Object} focus  the focus kuery.`,
      true,
      () => ({ overrideLens: [
        Valaa.Lens.loadingLens,
        <div {..._lensMessageLoadingProps}>
          <div {..._message}>Waiting for focus kuery to complete.</div>
          <div {..._parameters}>
            <span {..._key}>Focus:</span>
            <span {..._value}>{Valaa.Lens.debugFocusLens}</span>
          </div>
          {commonMessageRows}
        </div>
      ] })
  );

  createLensRoleSymbol("kueryingPropsLens",
      "Lens",
      `Lens role for displaying a description of one or more unfinished props kueries.

      @param {Object} props  the unfinished props kueries.`,
      true,
      () => ({ overrideLens: [
        Valaa.Lens.loadingLens,
        <div {..._lensMessageLoadingProps}>
          <div {..._message}>Waiting for props kueries to complete.</div>
          <div {..._parameters}>
            <span {..._key}>Props kueries:</span>
            <span {..._value}>{Valaa.Lens.debugFocusLens}</span>
          </div>
          {commonMessageRows}
        </div>
      ] })
  );

  createLensRoleSymbol("pendingPropsLens",
      "Lens",
      `Lens role for displaying the description of props which are pending Promises.

      @param {Object} props  the pending props Promises.`,
      true,
      () => ({ overrideLens: [
        Valaa.Lens.loadingLens,
        <div {..._lensMessageLoadingProps}>
          <div {..._message}>Waiting for pending props Promise(s) to resolve.</div>
          <div {..._parameters}>
            <span {..._key}>Props promises:</span>
            <span {..._value}>{Valaa.Lens.debugFocusLens}</span>
          </div>
          {commonMessageRows}
        </div>
      ] })
  );

  createLensRoleSymbol("pendingChildrenLens",
      "Lens",
      `Lens role for displaying a description of pending children Promise.

      @param {Object} children  the pending children Promise.`,
      true,
      () => ({ overrideLens: [
        Valaa.Lens.loadingLens,
        <div {..._lensMessageLoadingProps}>
          <div {..._message}>  Waiting for a pending children Promise to resolve.</div>
          <div {..._parameters}>
            <span {..._key}>Children promise:</span>
            <span {..._value}>{Valaa.Lens.debugFocusLens}</span>
          </div>
          {commonMessageRows}
        </div>
      ] })
  );

  createLensRoleSymbol("activatingLens",
      "Lens",
      `Lens role for displaying an activating Resource focus of a
      loaded component.

      @param {Object} focus  the activating Resource focus.`,
      (focus?: Vrapper) => focus && focus.isActivating(),
      () => ({ overrideLens: [
        Valaa.Lens.loadingLens,
        <div {..._lensMessageLoadingProps}>
          <div {..._message}>Activating focus {Valaa.Lens.describeFocusLens}.</div>
          <div {..._parameters}>
            <span {..._key}>Focus resource info:</span>
            <span {..._value}>{Valaa.Lens.debugFocusLens}</span>
          </div>
          {commonMessageRows}
        </div>
      ] })
  );

  createLensRoleSymbol("inactiveLens",
      "Lens",
      `Lens role for displaying an inactive Resource focus of a loaded
      component.

      @param {Object} focus  the inactive Resource focus.`,
      (focus?: Vrapper) => focus && focus.isInactive(),
      () => ({ overrideLens: [
        Valaa.Lens.loadingFailedLens,
        <div {..._lensMessageLoadingFailedProps}>
          <div {..._message}>Focus {Valaa.Lens.describeFocusLens} is inactive.</div>
          <div {..._parameters}>
            <span {..._key}>Focus resource info:</span>
            <span {..._value}>{Valaa.Lens.debugFocusLens}</span>
          </div>
          {commonMessageRows}
        </div>
      ] })
  );

  createLensRoleSymbol("unavailableLens",
      "Lens",
      `Lens role for displaying an unavailable Resource focus of a
      loaded component.

      @param {Object} focus  the unavailable Resource focus.`,
      (focus?: Vrapper) => focus && focus.isUnavailable(),
      () => ({ overrideLens: [
        Valaa.Lens.loadingFailedLens,
        <div {..._lensMessageLoadingFailedProps}>
          <div {..._message}>Focus {Valaa.Lens.describeFocusLens} is unavailable.</div>
          <div {..._parameters}>
            <span {..._key}>Focus resource info:</span>
            <span {..._value}>{Valaa.Lens.debugFocusLens}</span>
          </div>
          {commonMessageRows}
        </div>
      ] })
  );

  createLensRoleSymbol("destroyedLens",
      "Lens",
      `Lens role for displaying a destroyed Resource focus of a loaded
      component.

      @param {Object} focus  the destroyed Resource focus.`,
      (focus?: Vrapper) => focus && focus.isDestroyed(),
      () => ({ overrideLens: [
        Valaa.Lens.loadingFailedLens,
        <div {..._lensMessageLoadingFailedProps}>
          <div {..._message}>Focus {Valaa.Lens.describeFocusLens} has been destroyed.</div>
          <div {..._parameters}>
            <span {..._key}>Focus resource info:</span>
            <span {..._value}>{Valaa.Lens.debugFocusLens}</span>
          </div>
          {commonMessageRows}
        </div>
      ] })
  );

  createLensRoleSymbol("lensPropertyNotFoundLens",
      "Lens",
      `Lens role for displaying a description of an active Resource
      focus which does not have a requested lens property.

      @param {Object} focus  the active Resource focus.`,
      true,
      () => ({ overrideLens: [
        Valaa.Lens.loadingFailedLens,
        <div {..._lensMessageLoadingFailedProps}>
          <div {..._message}>
            Cannot find a lens property from the active focus {Valaa.Lens.describeFocusLens}.
          </div>
          <div {..._parameters}>
            <span {..._key}>Property candidates:</span>
            <span {..._value}>{Valaa.instrument(Valaa.Lens.lensProperty, p => p.join(", "))}</span>
          </div>
          <div {..._parameters}>
            <span {..._key}>Focus being searched:</span>
            <span {..._value}>{Valaa.Lens.debugFocusLens}</span>
          </div>
          {commonMessageRows}
        </div>
      ] })
  );

/*
  createLensRoleSymbol("fixedLens",
      "Lens",
      `DEPRECATED; prefer Valaa.Lens.lens.`,
      true,
      () => undefined);

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
*/
  finalizeLensDescriptors();
  return Valaa.Lens;
}
