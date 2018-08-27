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
  async attach (options : Object) {
    await super.attach(options);
    try {
      // Set title
      if (options.setTitleKuery) {
        const newTitle = this._vViewFocus.get(options.setTitleKuery);
        if (typeof newTitle === "string") document.title = newTitle;
        else {
          this.warnEvent(`Ignored a request to set document.title to non-string value:`, newTitle,
              "\n\tvia setTitleKuery:", ...dumpKuery(options.setTitleKuery),
              "\n\tUIRoot:", ...dumpObject(this._vViewFocus));
        }
      }

      // Renderer
      this._createReactRoot(options.rootId, options.container, this._vViewFocus, options.name);
      this.engine.addCog(this);
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
  _createReactRoot (rootId: string, container: Object, vViewFocus: Vrapper, viewName: string) {
    this._rootElement = document.createElement("DIV");
    this._rootElement.setAttribute("id", rootId);
    container.appendChild(this._rootElement);
    this._reactRoot = (<ReactRoot
      viewName={viewName}
      vViewFocus={vViewFocus}
      lensProperty={["ROOT_LENS", "LENS", "EDITOR_LENS"]}
    />);
    ReactDOM.render(this._reactRoot, this._rootElement);
  }

  _destroy () {
    // This is not called from anywhere as is...
    ReactDOM.unmountComponentAtNode(this._rootElement);
  }
}
