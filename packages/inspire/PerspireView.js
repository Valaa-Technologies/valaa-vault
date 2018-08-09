// @flow

import Vrapper from "~/engine/Vrapper";
import ReactRoot from "~/inspire/ui/ReactRoot";
import VDOMView from "~/inspire/VDOMView";

import React from "react";
import { renderToString } from "react-dom/server";
import ReactDOM from "react-dom";

/**
 * This class is the view entry point
 */
export default class PerspireView extends VDOMView {
  async initialize (options : Object) {
    await this.initializeVDOM(options);
    try {
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
    this._html = renderToString(
        <ReactRoot
          vUIRoot={vUIRoot}
          lensProperty={[
            "ROOT_LENS",
            "LENS",
            "EDITOR_LENS",
            "EDITOR_UI_JSX"
          ]}
        />);
  }

  _destroy () {
  }
}
