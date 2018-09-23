// @flow

import React from "react";
import ReactDOM from "react-dom";


import { vRefFromURI } from "~/raem/ValaaReference";

import Vrapper from "~/engine/Vrapper";
import Cog from "~/engine/Cog";

import ReactRoot from "~/inspire/ui/ReactRoot";

/**
 * This class is the view entry point
 */
export default class VDOMView extends Cog {
  async attach ({ name, rootLensURI }: Object) {
    try {
      if (!rootLensURI) {
        throw new Error(`No options.rootLensURI found for view ${name}`);
      }
      // Load project
      const lensRef = vRefFromURI(rootLensURI);
      this._rootConnection = await this.engine.prophet
          .acquirePartitionConnection(lensRef.getPartitionURI())
          .getSyncedConnection();
      this._vViewFocus = await this.engine.getVrapper(
          lensRef.rawId() || this._rootConnection.getPartitionRawId());
      await this._vViewFocus.activate();
      this.warnEvent(`attach(): partition '${this._vViewFocus.get("name")}' UI view focus set:`,
          this._vViewFocus.debugId());
      // this.warn("\n\n");
      // this.warnEvent(`createView('${name}'): LISTING ENGINE RESOURCES`);
      // this.engine.outputStatus(this.getLogger());
      this.engine.addCog(this);
      return this;
    } catch (error) {
      throw this.wrapErrorEvent(error, `attach('${name}' -> ${rootLensURI})`);
    }
  }

  getSelfAsHead () {
    return this._vViewFocus.getSelfAsHead();
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
      lensProperty={["ROOT_LENS", "LENS", "EDITOR_LENS"]}
    />);
    return new Promise(onDone => {
      ReactDOM.render(this._reactRoot, this._rootElement, onDone);
    });
  }

  _destroy () {
    // This is not called from anywhere as it is
    ReactDOM.unmountComponentAtNode(this._rootElement);
  }
}
