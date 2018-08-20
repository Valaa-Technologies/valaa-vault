// @flow
import React from "react";
import ReactDOM from "react-dom";

import { vRefFromURI } from "~/raem/ValaaReference";

import Cog from "~/engine/Cog";
import Vrapper from "~/engine/Vrapper";
import { dumpKuery } from "~/engine/VALEK";

import ReactRoot from "~/inspire/ui/ReactRoot";

import { getGlobal, dumpObject } from "~/tools";

/**
 * This class is the view entry point
 */
export default class InspireView extends Cog {
  async initialize ({ name, container, rootId, setTitleKuery, size, rootLensURI }: Object) {
    try {
      if (!rootLensURI) {
        throw new Error(`No options.rootLensURI found for view ${name}`);
      }
      // Load project
      const lensRef = vRefFromURI(rootLensURI);
      this._rootConnection = await this.engine.prophet.acquirePartitionConnection(
          lensRef.partitionURI());
      this._vUIRoot = await this.engine.getVrapper(
          lensRef.rawId() || this._rootConnection.partitionRawId());
      this.warnEvent(`initialize(): partition '${this._vUIRoot.get("name")}' UI root set:`,
          this._vUIRoot.debugId());
      if (setTitleKuery) {
        const newTitle = this._vUIRoot.get(setTitleKuery);
        if (typeof newTitle === "string") document.title = newTitle;
        else {
          this.warnEvent(`Ignored a request to set document.title to non-string value:`, newTitle,
              "\n\tvia setTitleKuery:", ...dumpKuery(setTitleKuery),
              "\n\tUIRoot:", ...dumpObject(this._vUIRoot));
        }
      }
      // this.warn("\n\n");
      // this.warnEvent(`createView('${name}'): LISTING ENGINE RESOURCES`);
      // engine.outputStatus(this.getLogger());

      // Renderer
      this._createReactRoot(rootId, container, this._vUIRoot);
      this.engine.addCog(this);
      this.warnEvent(`initialize(): engine running and view connected to DOM (size`,
          size, `unused)`);
      return this;
    } catch (error) {
      throw this.wrapErrorEvent(error, `initialize('${name}' -> ${rootLensURI})`);
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
      vViewFocus={vViewFocus}
      lensProperty={["ROOT_LENS", "LENS", "EDITOR_LENS"]}
    />);
    ReactDOM.render(this._reactRoot, this._rootElement);
  }

  _destroy () {
    // This is not called from anywhere as is...
    ReactDOM.unmountComponentAtNode(this._rootElement);
  }

  getSelfAsHead () {
    return this._vUIRoot.getSelfAsHead();
  }


  setAsActiveInspireView () {
    console.log("Setting active Inspire View to", this.name);
    this.pauseActiveInspireView();
    getGlobal().activeInspireView = this;
    if (this.getTimeDilation() < 0) {
      this.resumeActiveInspireView();
    }
  }

  play () {
    const currentDilation = this.getTimeDilation();
    if (currentDilation > 0.00001) {
      return;
    } else if (currentDilation < -0.00001) {
      this.resumeActiveInspireView();
    } else {
      this.setTimeDilation(1);
      this.start();
    }
  }

  stop () {
    this.pause();
  }

  pause () {
    const currentTimeDilation = this.engine.getTimeDilation();
    if (currentTimeDilation > 0) {
      this.engine.setTimeDilation(currentTimeDilation * -1);
    }
  }

  resume () {
    const currentTimeDilation = this.engine.getTimeDilation();
    if (currentTimeDilation < 0) {
      this.engine.setTimeDilation(currentTimeDilation * -1);
    }
  }

  toggleBulletTime (bulletTimeDilation) {
    const currentTimeDilation = this.engine.getTimeDilation();
    if (currentTimeDilation < 1) {
      console.log("Resuming full speed playback for engine", this.name,
          "from", currentTimeDilation);
      this.engine.setTimeDilation(1);
    } else {
      console.log("Bullet timing engine", this.name, "playback to", bulletTimeDilation);
      this.engine.setTimeDilation(bulletTimeDilation);
    }
  }
}
