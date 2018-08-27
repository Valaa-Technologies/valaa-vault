// @flow

import { vRefFromURI } from "~/raem/ValaaReference";
import Cog from "~/engine/Cog";

/**
 * This class is the view entry point
 */
export default class VDOMView extends Cog {
  async attach ({ name, size, rootLensURI }: Object) {
    try {
      if (!rootLensURI) {
        throw new Error(`No options.rootLensURI found for view ${name}`);
      }
      // Load project
      const lensRef = vRefFromURI(rootLensURI);
      this._rootConnection = await this.engine.prophet.acquirePartitionConnection(
          lensRef.partitionURI());
      this._vViewFocus = await this.engine.getVrapper(
          lensRef.rawId() || this._rootConnection.partitionRawId());
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
}
