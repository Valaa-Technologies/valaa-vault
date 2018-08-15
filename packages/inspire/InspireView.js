// @flow
import React from "react";
import ReactDOM from "react-dom";

import Vrapper from "~/engine/Vrapper";
import { dumpKuery, dumpObject } from "~/engine/VALEK";
import ReactRoot from "~/inspire/ui/ReactRoot";
import VDOMView from "~/inspire/VDOMView";

/**
 * This class is the view entry point
 */
export default class InspireView extends VDOMView {
  async initialize (options : Object) {
    await this.initializeVDOM(options);
    try {
      // Set title
      if (options.setTitleKuery) {
        const newTitle = this._vUIRoot.get(options.setTitleKuery);
        if (typeof newTitle === "string") document.title = newTitle;
        else {
          this.warnEvent(`Ignored a request to set document.title to non-string value:`, newTitle,
              "\n\tvia setTitleKuery:", ...dumpKuery(options.setTitleKuery),
              "\n\tUIRoot:", ...dumpObject(this._vUIRoot));
        }
      }

      // Renderer
      this._createReactRoot(options.rootId, options.container, this._vUIRoot);
      this.warnEvent(`initialize(): engine running and view connected to DOM (size`,
          options.size, `unused)`);
      return this;
    } catch (error) {
      throw this.wrapErrorEvent(error, `initialize('${options.name}' -> ${options.rootLensURI})`);
    }
  }

 /**
  * Creates the root UI component with the react context, and connects it to the html container.
  */
  _createReactRoot (rootId: string, container: Object, vUIRoot: Vrapper) {
    this._rootElement = document.createElement("DIV");
    this._rootElement.setAttribute("id", rootId);
    container.appendChild(this._rootElement);
    this._reactRoot = (<ReactRoot
      vUIRoot={vUIRoot}
      lensProperty={["ROOT_LENS", "LENS", "EDITOR_LENS", "EDITOR_UI_JSX"]}
    />);
    ReactDOM.render(this._reactRoot, this._rootElement);
  }

  _destroy () {
    // This is not called from anywhere as is...
    ReactDOM.unmountComponentAtNode(this._rootElement);
  }
}
