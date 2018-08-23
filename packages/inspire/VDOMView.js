// @flow

import { vRefFromURI } from "~/raem/ValaaReference";
import Cog from "~/engine/Cog";

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
}
