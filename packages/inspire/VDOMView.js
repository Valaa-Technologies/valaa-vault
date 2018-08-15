// @flow

import { vRefFromURI } from "~/raem/ValaaReference";

import Cog from "~/engine/Cog";

import { getGlobal } from "~/tools";

/**
 * This class is the view entry point
 */
export default class VDOMView extends Cog {
  async initializeVDOM ({ name, size, rootLensURI }: Object) {
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
      // this.warn("\n\n");
      // this.warnEvent(`createView('${name}'): LISTING ENGINE RESOURCES`);
      // engine.outputStatus(this.getLogger());
      this.engine.addCog(this);
      this.warnEvent(`initialize(): engine running and view connected to DOM (size`,
          size, `unused)`);
      return this;
    } catch (error) {
      throw this.wrapErrorEvent(error, `initialize('${name}' -> ${rootLensURI})`);
    }
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
