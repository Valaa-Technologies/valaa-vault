// @flow

// FIXME(iridian): Remove react dependency by moving injectLensObjects.js to valaa-inspire
import React from "react";

import Vrapper from "~/valaa-engine/Vrapper";
// FIXME(iridian): Removes cross-dependency to valaa-inspire
import UIComponent from "~/valaa-inspire/ui/base/UIComponent";

export default function injectLensObjects (Valaa: Object, rootScope: Object,
    hostObjectDescriptors: Object) {
  Valaa.Lens = {};
  const lensDescriptorOptions = {};
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

  createLensRoleSymbol("rootRoleName",
      "string",
      `the root lens role name which is currently being rendered.`);
  createLensRoleSymbol("disabledLens",
      "Lens",
      `Lens role for when the focus, another lens or some lens prop is not available.`,
      true,
      () => <div>No lens found or component is disabled, no focus or context available.</div>);
  createLensRoleSymbol("loadingLens",
      "Lens",
      `Lens role for when the focus, another lens or some lens prop is is still being loaded.`,
      true,
      () => <div>
          {Valaa.Lens.rootRoleName}: Some lens component still loading, with focus: {
              Valaa.Lens.describeFocusLens}...
      </div>);
  createLensRoleSymbol("delayedLens",
      "Lens",
      `Lens role for when some lens sub-component is a non-resolved promise.`,
      true,
      () => <div>
          {Valaa.Lens.rootRoleName}: Some lens component is delayed, with focus: {
              Valaa.Lens.describeFocusLens}...
      </div>);
  createLensRoleSymbol("downloadingLens",
      "Lens",
      `Lens role for when Media content for the focus, another lens or some lens prop is still${
          ""} being downloaded.`,
      true,
      () => <div>
          {Valaa.Lens.rootRoleName}: Some lens component is being downloaded, with focus: {
              Valaa.Lens.describeFocusLens}...
      </div>);
  createLensRoleSymbol("connectingLens",
      "Lens",
      `Lens role for when an operation threw a missing partition connection error and implicit${
          ""} partition connection process was triggered.`,
      true,
      () => <div>
          {Valaa.Lens.rootRoleName}: Connecting to partitions {Valaa.Lens.unconnectedPartitionNames
              }, with focus: {Valaa.Lens.describeFocusLens}...
      </div>);
  createLensRoleSymbol("unconnectedPartitionNames",
      "(string | string[])",
      `partition URI's which are being implicitly connected.`);
  createLensRoleSymbol("pendingLens",
      "Lens",
      `Lens role for when a partition of the focus, of another lens or of some lens prop is still${
          ""} being connected.`,
      true,
      () => <div>
          {Valaa.Lens.rootRoleName}: Some lens component kuery or partition connection pending,
              with focus: {Valaa.Lens.describeFocusLens}...
      </div>);
  createLensRoleSymbol("pendingFocusLens",
      "Lens",
      `Lens role for when the focus kuery or its partition connection is still pending.`,
      true,
      () => <div>
          {Valaa.Lens.rootRoleName}: Kuery or partition connection pending, with focus: {
              Valaa.Lens.describeFocusLens}...
      </div>);
  createLensRoleSymbol("pendingPropsLens",
      "Lens",
      `Lens role for when the kuery for some props is still pending.`,
      true,
      () => <div>
          {Valaa.Lens.rootRoleName}: Props {Valaa.Lens.pendingPropNames
              } kuery(s) are pending, with focus: {Valaa.Lens.describeFocusLens}...
      </div>);
  createLensRoleSymbol("pendingPropNames",
      "(string | string[])",
      `props name or array of props names for which a kuery is still pending.`);
  createLensRoleSymbol("delayedPropsLens",
      "Lens",
      `Lens role for when the direct value for some props is non-resolved promise.`,
      true,
      () => <div>
          {Valaa.Lens.rootRoleName}: Props {Valaa.Lens.delayedPropNames
              } value(s) are delayed, with focus: {Valaa.Lens.describeFocusLens}...
      </div>);
  createLensRoleSymbol("delayedPropNames",
      "(string | string[])",
      `props name or array of props names whose values are still non-resolved promises.`);
  createLensRoleSymbol("delayedChildrenLens",
      "Lens",
      `Lens role for when some child entry is a non-resolved promise.`,
      true,
      () => <div>
          {Valaa.Lens.rootRoleName}: Some child element is delayed, with focus: {
              Valaa.Lens.describeFocusLens}...
      </div>);
  createLensRoleSymbol("fixedLens",
      "Lens",
      `DEPRECATED; prefer Valaa.Lens.lens.`,
      true,
      () => undefined);
  createLensRoleSymbol("lens",
      "Lens",
      `Lens role for a fully loaded component.`,
      true,
      () => undefined);
  createLensRoleSymbol("nullLens",
      "Lens",
      `Lens role for null focus.`,
      (component: UIComponent, focus?: Vrapper) => (focus === null),
      () => null);
  createLensRoleSymbol("resourceLens",
      "Lens",
      `Lens role for whe the focus is a Resource.`,
      (component: UIComponent, focus?: Vrapper) => (focus instanceof Vrapper),
      () => ({ overrideLens: [
        Valaa.Lens.activeLens,
        Valaa.Lens.activatingLens,
        Valaa.Lens.inactiveLens,
        Valaa.Lens.destroyedLens,
        Valaa.Lens.unavailableLens,
      ] }));
  createLensRoleSymbol("activeLens",
      "Lens",
      `Lens role for when the focus is a fully active Resource.`,
      (component: UIComponent, focus?: Vrapper) => focus && focus.isActive(),
      () => Valaa.Lens.propertyLens);
  createLensRoleSymbol("activatingLens",
      "Lens",
      `Lens role for when the focus is a Resource which is still being activated.`,
      (component: UIComponent, focus?: Vrapper) => focus && focus.isActivating(),
      () => <div>
          Focus Activating: {Valaa.Lens.describeFocusLens}...
      </div>);
  createLensRoleSymbol("inactiveLens",
      "Lens",
      `Lens role for when the focus is an inactive Resource.`,
      (component: UIComponent, focus?: Vrapper) => focus && focus.isInactive(),
      () => <div>
          Focus Inactive: {Valaa.Lens.describeFocusLens}
      </div>);
  createLensRoleSymbol("unavailableLens",
      "Lens",
      `Lens role for when the focus is an unavailable Resource.`,
      (component: UIComponent, focus?: Vrapper) => focus && focus.isUnavailable(),
      () => <div>
          Focus Unavailable: {Valaa.Lens.describeFocusLens}
      </div>);
  createLensRoleSymbol("destroyedLens",
      "Lens",
      `Lens role for when the focus is a destroyed Resource.`,
      (component: UIComponent, focus?: Vrapper) => focus && focus.isDestroyed(),
      () => <div>
          Focus Destroyed: {Valaa.Lens.describeFocusLens}
      </div>);
  createLensRoleSymbol("propertyLens",
      "Lens",
      `Lens role for using a property of a fully active focus Resource as the lens.${
          ""} By default retrieves 'lensProperty' from props or 'Valaa.Lens.lensProperty' from${
          ""} context and then searches the focus for a matching property.${
          ""} If lensProperty is an array the first matching property from focus is used.${
          ""} If 'lensProperty' itself or no matching property can be found falls back to${
          ""} 'lensPropertyNotFoundLens'.`,
      (component: UIComponent, focus?: Vrapper) => focus && focus.hasInterface("Scope"),
      () => function renderPropertyLens (context: Object, component: UIComponent) {
        const focus = context.focus;
        const props = component.props;
        const lensProperty = props.lensProperty || props.lensName
            || component.getUIContextValue(Valaa.Lens.lensProperty)
            || component.context.lensProperty;
        if (lensProperty) {
          const focusLexicalScope = focus.getLexicalScope();
          for (const propertyName of Array.isArray(lensProperty) ? lensProperty : [lensProperty]) {
            if (focusLexicalScope.hasOwnProperty(propertyName)) {
              return focusLexicalScope[propertyName].extractValue();
            }
          }
        }
        return {
          overrideLens: [Valaa.Lens.fallbackLens, Valaa.Lens.lensPropertyNotFoundLens],
        };
      });
  createLensRoleSymbol("lensProperty",
      "(string | string[])",
      `property name or array of property names that are searched from an active focus resource${
          ""} when rendering 'propertyLens' role.`);
  createLensRoleSymbol("lensPropertyNotFoundLens",
      "Lens",
      `Lens role for when the focus Resource does not have a matching lens property.`,
      true,
      () => <div>
          Could not find lens property ({Valaa.Lens.lensProperty}) from focus: {
              Valaa.Lens.describeFocusLens}
      </div>);
  createLensRoleSymbol("fallbackLens",
      "Lens",
      `DEPRECATED; prefer lensPropertyNotFoundLens.`,
      true,
      () => (context: Object, component: UIComponent) => {
        console.error("DEPRECATED: Valaa.Lens.fallbackLens",
            "\n\tprefer: Valaa.Lens.lensPropertyNotFoundLens",
            "\n\tin component:", component.debugId());
        return Valaa.Lens.lensPropertyNotFoundLens;
      });
  createLensRoleSymbol("childrenLens",
      "Lens",
      `Lens role for using the child elements of this element as the lens.`,
      true,
      () => (context: Object, component: UIComponent) => component.props.children);
  createLensRoleSymbol("describeFocusLens",
      "Lens",
      `Lens role for rendering developer-oriented description of the current focus.`,
      true,
      () => (function renderFocusDescription (context: Object, component: UIComponent,
          focus: any = component.tryFocus()) {
        switch (typeof focus) {
          case "string":
            return `<"${focus.length <= 40 ? focus : `${focus.slice(0, 37)}...`}">`;
          case "function":
            return `<function '${focus.name}'>`;
          case "object": {
            if (focus !== null) {
              if (focus instanceof Vrapper) return `<${focus.debugId()}>`;
              if (Array.isArray(focus)) {
                return `[${focus.map(entry => renderFocusDescription(context, component, entry))
                    .join(", ")}]`;
              }
              return `<Object.keys: ['${Object.keys(focus).join(", ")}']>`;
            }
          }
          // eslint-disable-next-line no-fallthrough
          default:
            return `<${String(focus)}>`;
        }
      }));

  finalizeLensDescriptors();
  return Valaa.Lens;
}
