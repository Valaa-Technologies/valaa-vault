// @flow
import React from "react";
import PropTypes from "prop-types";

import Presentable from "~/inspire/ui/Presentable";
import UIComponent, { LENS } from "~/inspire/ui/UIComponent";
import ValaaScope from "~/inspire/ui/ValaaScope";

import Vrapper from "~/engine/Vrapper";

import VALEK from "~/engine/VALEK";

import { invariantify, thenChainEagerly } from "~/tools";

@Presentable(require("./presentation").default, "UIContext")
export default class UIContext extends UIComponent {
  static contextTypes = {
    ...UIComponent.contextTypes,
    lensContext: PropTypes.object,
    lensProperty: PropTypes.oneOfType([PropTypes.string, PropTypes.arrayOf(PropTypes.string)]),
    fallbackLens: PropTypes.any,
  }

  static registeredBuiltinElements = {};

  static registerBuiltinElement = (id, klass) => {
    UIContext.registeredBuiltinElements[id] = klass;
  };

  static childContextTypes = {
    lensProperty: PropTypes.oneOfType([PropTypes.string, PropTypes.arrayOf(PropTypes.string)]),
    fallbackLens: PropTypes.any,
  }

  vJSXUIDefaultMedia: Object;

  static toDefaultLens = VALEK.propertyValue("DEFAULT_LENS", { optional: true })
        .or(VALEK.propertyValue("DEFAULT_CHILD_UI_JSX", { optional: true }));

  attachSubscribers (focus: any, props: Object) {
    super.attachSubscribers(focus, props);
    invariantify(focus instanceof Vrapper,
        "UIContext(%s).focus(%s) must be a Valaa object", this, focus);
    invariantify(focus.hasInterface("Scope"), "UIContext.focus must implement Scope");
    this.attachKuerySubscriber("UIContext[DEFAULT_LENS]", focus, UIContext.toDefaultLens, {
      onUpdate: (update) => {
        const fallbackLens = update.value();
        if (fallbackLens) {
          // UIContext always waits for the fallbackLens context to be available before setting it
          // for the children.
          thenChainEagerly(
              (fallbackLens instanceof Vrapper)
                  && fallbackLens.hasInterface("Media")
                  && fallbackLens.interpretContent({ mimeFallback: "text/vsx" }),
              (lensMediaContent) => {
                this.setState({ fallbackLens, active: true });
                this.outputDiagnostic(lensMediaContent, fallbackLens);
              });
        } else {
          invariantify(typeof this.context.fallbackLens !== "undefined",
              "UIContext.context.fallbackLens (when no DEFAULT_LENS is given)");
          this.setState({ fallbackLens: this.context.fallbackLens, active: true });
          this.outputDiagnostic(undefined, this.context.fallbackLens);
        }
      }
    });
  }

  outputDiagnostic (fallbackLensText: ?string, fallbackLens: any) {
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
                }' as child fallback Lens:`, fallbackLens, "\n", fallbackLensText]
            : [`\n\tforwarding fallback Lens from parent context:`, fallbackLens]),
    );
  }

  getChildContext () {
    return {
      lensProperty:
          (this.getFocus().isActive()
              && this.getFocus().get(VALEK.propertyLiteral("DEFAULT_LENS_NAME", { optional: true })
                  .or(VALEK.propertyLiteral("JSX_UI_PROPERTY_NAME", { optional: true }))))
          || this.context.lensProperty,
      fallbackLens: this.state.fallbackLens,
    };
  }

  preRenderFocus (focus: Object) {
    if (!this.state.active) return null;
    const uiRootElement = this.createUIRootElement(focus);
    return uiRootElement;
  }

  createUIRootElement (focus: Object) {
    const renderedChildren = super.renderActiveFocus(focus);
    const defaultJSXElement = this.state.fallbackLens
        && <ValaaScope {...this.childProps("uiRootDefault")} activeLens={LENS`fallbackLens`} />;
    return (renderedChildren && defaultJSXElement)
        ? <div>{renderedChildren}{defaultJSXElement}</div>
        : defaultJSXElement || renderedChildren;
  }
}
