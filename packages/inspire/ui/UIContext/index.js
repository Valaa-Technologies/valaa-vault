// @flow
import React from "react";
import PropTypes from "prop-types";

import Presentable from "~/inspire/ui/Presentable";
import UIComponent, { LENS } from "~/inspire/ui/UIComponent";
import ValaaScope from "~/inspire/ui/ValaaScope";

import Vrapper from "~/engine/Vrapper";

import VALEK from "~/engine/VALEK";

import { invariantify, thenChainEagerly } from "~/tools";

export default @Presentable(require("./presentation").default, "UIContext")
class UIContext extends UIComponent {
  static contextTypes = {
    ...UIComponent.contextTypes,
    lensProperty: PropTypes.oneOfType([PropTypes.string, PropTypes.arrayOf(PropTypes.string)]),
    lensPropertyNotFoundLens: PropTypes.any,
  }

  static registeredBuiltinElements = {};

  static registerBuiltinElement = (id, klass) => {
    UIContext.registeredBuiltinElements[id] = klass;
  };

  static childContextTypes = {
    lensProperty: PropTypes.oneOfType([PropTypes.string, PropTypes.arrayOf(PropTypes.string)]),
    lensPropertyNotFoundLens: PropTypes.any,
  }

  vJSXUIDefaultMedia: Object;

  static toDefaultLens = VALEK.propertyValue("DEFAULT_LENS", { optional: true })
        .or(VALEK.propertyValue("DEFAULT_CHILD_UI_JSX", { optional: true }));

  bindFocusSubscriptions (focus: any, props: Object) {
    super.bindFocusSubscriptions(focus, props);
    invariantify(focus instanceof Vrapper,
        "UIContext(%s).focus(%s) must be a Valaa object", this, focus);
    invariantify(focus.hasInterface("Scope"), "UIContext.focus must implement Scope");
    this.bindNewKuerySubscription("UIContext_DEFAULT_LENS",
        focus, UIContext.toDefaultLens, {},
        (update) => {
          const lensPropertyNotFoundLens = update.value();
          if (lensPropertyNotFoundLens) {
            // UIContext always waits for the lensPropertyNotFoundLens
            // context to be available before setting it for the children.
            thenChainEagerly(
                (lensPropertyNotFoundLens instanceof Vrapper)
                    && lensPropertyNotFoundLens.hasInterface("Media")
                    && lensPropertyNotFoundLens.interpretContent({ mimeFallback: "text/vsx" }),
                (lensMediaContent) => {
                  this.setState({ lensPropertyNotFoundLens, active: true });
                  this.outputDiagnostic(lensMediaContent, lensPropertyNotFoundLens);
                });
          } else {
            invariantify(typeof this.context.lensPropertyNotFoundLens !== "undefined",
                "UIContext.context.lensPropertyNotFoundLens (when no DEFAULT_LENS is given)");
            this.setState({
              lensPropertyNotFoundLens: this.context.lensPropertyNotFoundLens, active: true,
            });
            this.outputDiagnostic(undefined, this.context.lensPropertyNotFoundLens);
          }
        });
  }

  outputDiagnostic (fallbackLensText: ?string, lensPropertyNotFoundLens: any) {
    const lensProperty = this.getFocus().get(
        VALEK.propertyLiteral("DEFAULT_LENS_NAME", { optional: true })
            .or(VALEK.propertyLiteral("JSX_UI_PROPERTY_NAME", { optional: true })));
    console.warn(`${this.constructor.name}/UIContext(${this.debugId()}) context configuration:`,
        "\n\tthis:", this,
        ...(lensProperty
            ? ["\n\tlensProperty (from DEFAULT_LENS_NAME/JSX_UI_PROPERTY_NAME):", lensProperty]
            : ["\n\tlensProperty (inherited from parent context):", this.context.lensProperty]),
        ...(fallbackLensText
            ? [`\n\tusing custom jsxUIDefaultMedia '${this.vJSXUIDefaultMedia.get("name")
                }' as child fallback Lens:`, lensPropertyNotFoundLens, "\n", fallbackLensText]
            : [`\n\tforwarding fallback Lens from parent context:`, lensPropertyNotFoundLens]),
    );
  }

  getChildContext () {
    return {
      lensProperty:
          (this.getFocus().isActive()
              && this.getFocus().get(VALEK.propertyLiteral("DEFAULT_LENS_NAME", { optional: true })
                  .or(VALEK.propertyLiteral("JSX_UI_PROPERTY_NAME", { optional: true }))))
          || this.context.lensProperty,
      lensPropertyNotFoundLens: this.state.lensPropertyNotFoundLens,
    };
  }

  preRenderFocus (focus: Object) {
    if (!this.state.active) return null;
    const uiRootElement = this.createUIRootElement(focus);
    return uiRootElement;
  }

  createUIRootElement (focus: Object) {
    const renderedChildren = super.renderLoaded(focus);
    const defaultJSXElement = this.state.lensPropertyNotFoundLens && (
      <ValaaScope
        {...this.childProps("uiRootDefault")}
        activeLens={LENS`lensPropertyNotFoundLens`}
      />
    );
    return (renderedChildren && defaultJSXElement)
        ? <div>{renderedChildren}{defaultJSXElement}</div>
        : defaultJSXElement || renderedChildren;
  }
}
