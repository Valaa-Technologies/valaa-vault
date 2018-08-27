// @flow
import "@babel/polyfill";
import Vrapper from "~/engine/Vrapper";
import ReactRoot from "~/inspire/ui/ReactRoot";
import VDOMView from "~/inspire/VDOMView";

import React from "react";
import ReactDOM from "react-dom";

/**
 * This class is the view entry point
 */
export default class PerspireView extends VDOMView {
  async attach (options : Object) {
    await super.attach(options);
    try {
      // Renderer
      this._createReactRoot(options.rootId, options.window, options.container, this._vUIRoot);
      this.warnEvent(`attach(): engine running and view attached to DOM (size`,
          options.size, `unused)`);
      return this;
    } catch (error) {
      throw this.wrapErrorEvent(error, `attach('${options.name}' -> ${options.rootLensURI})`);
    }
  }

 /**
  * Creates the root UI component with the react context, and connects it to the html container.
  */
  _createReactRoot (rootId: string, window: Object, container: Object, vUIRoot: Vrapper) {
    this._rootElement = window.document.createElement("DIV");
    this._rootElement.setAttribute("id", rootId);
    container.appendChild(this._rootElement);
    this._reactRoot = (<ReactRoot
      viewName={viewName}
      vViewFocus={vViewFocus}
      lensProperty={["ROOT_LENS", "LENS", "EDITOR_LENS", "EDITOR_UI_JSX"]}
    />);
    ReactDOM.render(this._reactRoot, this._rootElement);
  }

  _destroy () {
    ReactDOM.unmountComponentAtNode(this._rootElement);
  }
}
