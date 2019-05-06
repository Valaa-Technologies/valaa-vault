// @flow

import React from "react";
import ReactDOM from "react-dom";

import Vrapper from "~/engine/Vrapper";
import Cog from "~/engine/Cog";

import ReactRoot from "~/inspire/ui/ReactRoot";

/**
 * This class is the view entry point
 */
export default class VDOMView extends Cog {
  constructor (options) {
    super(options);
    this._gateway = options.gateway;
  }

  async preAttach ({ name, lensURI, rootLensURI }: Object) {
    const actualLensURI = lensURI || rootLensURI;
    try {
      if (!actualLensURI) {
        throw new Error(`No options.lensURI found for view ${name}`);
      }
      if (rootLensURI) {
        this.warnEvent(`${name}.rootLensURI is DEPRECATED in favor of lensURI`);
      }
      // Load project
      const lensRef = this.engine.discourse.obtainReference(actualLensURI);
      this._viewPartition = await this.engine.discourse
          .acquireConnection(lensRef.getPartitionURI())
          .asActiveConnection();
      this._vViewFocus = await this.engine.getVrapperByRawId(
          lensRef.rawId() || this._viewPartition.getPartitionRawId());
      this._lensPropertyName = lensRef.getQueryComponent().lens;
      await this._vViewFocus.activate();
      this.warnEvent(`preAttach(): partition '${this._vViewFocus.get("name")}' UI view focus set:`,
          this._vViewFocus.debugId());
      // this.warn("\n\n");
      // this.warnEvent(`createView('${name}'): LISTING ENGINE RESOURCES`);
      // this.engine.outputStatus(this.getLogger());
      this.engine.addCog(this);
      return this;
    } catch (error) {
      throw this.wrapErrorEvent(error, `preAttach('${name}' -> ${actualLensURI})`);
    }
  }

  getViewPartition () { return this._viewPartition; }

  getViewFocus () { return this._vViewFocus;  }

  getSelfAsHead () {
    return this._vViewFocus.getSelfAsHead();
  }

  run (head: any, kuery: Object, options: Object) {
    return this._vViewFocus.run(head, kuery, options);
  }

 /**
  * Creates the root UI component with the react context, and connects it to the html container.
  */
  async _createReactRoot (rootId: string, window: Object, container: Object, viewName: string,
      vViewFocus: Vrapper, lensPropertyName: ?string) {
    this._rootElement = window.document.createElement("DIV");
    this._rootElement.setAttribute("id", rootId);
    container.appendChild(this._rootElement);
    const lensProperty = lensPropertyName
        ? [lensPropertyName]
        : ["ROOT_LENS", "LENS", "EDITOR_LENS"];
    this._reactRoot =
        <ReactRoot viewName={viewName} vViewFocus={vViewFocus} lensProperty={lensProperty} />;
    return new Promise(onDone => {
      ReactDOM.render(this._reactRoot, this._rootElement, onDone);
    });
  }

  _destroy () {
    // This is not called from anywhere as it is
    ReactDOM.unmountComponentAtNode(this._rootElement);
  }
}
