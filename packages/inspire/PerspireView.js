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
      await this._createReactRoot(options.rootId, options.window, options.container,
          this._vViewFocus, options.name);
      this.warnEvent(`attach(): engine running and view attached to DOM (size`,
          options.size, `unused)`);
      let pendingConnections;
      while (true) {
        pendingConnections = this._vViewFocus.engine.prophet.getPendingPartitionConnections();
        const keys = Object.keys(pendingConnections);
        if (!keys.length) break;
        this.warnEvent(`attach(): acquiring pending UI-initiated connections:`, ...keys);
        await Promise.all(Object.values(pendingConnections));
      }
      this.warnEvent(`attach(): all connections acquired:`,
          ...Object.values(this._vViewFocus.engine.prophet.getFullPartitionConnections())
              .map(connection => `\n\t${connection.debugId()}`));
      return this;
    } catch (error) {
      throw this.wrapErrorEvent(error, `attach('${options.name}' -> ${options.rootLensURI})`);
    }
  }

 /**
  * Creates the root UI component with the react context, and connects it to the html container.
  */
  async _createReactRoot (rootId: string, window: Object, container: Object, vViewFocus: Vrapper,
      viewName: string) {
    this._rootElement = window.document.createElement("DIV");
    this._rootElement.setAttribute("id", rootId);
    container.appendChild(this._rootElement);
    this._reactRoot = (<ReactRoot
      viewName={viewName}
      vViewFocus={vViewFocus}
      lensProperty={["ROOT_LENS", "LENS", "EDITOR_LENS", "EDITOR_UI_JSX"]}
    />);
    return new Promise(onDone => { ReactDOM.render(this._reactRoot, this._rootElement, onDone); });
  }

  _destroy () {
    ReactDOM.unmountComponentAtNode(this._rootElement);
  }
}
