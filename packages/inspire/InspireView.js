// @flow

import { dumpKuery, dumpObject } from "~/engine/VALEK";
import VDOMView from "~/inspire/VDOMView";

/**
 * This class is the view entry point
 */
export default class InspireView extends VDOMView {
  async attach (container: Object, options: Object) {
    await this.preAttach(options);
    try {
      if (options.setTitleKuery) this._setTitle(options.setTitleKuery);

      // Renderer
      await this._createReactRoot(options.viewRootId, container, options.name,
          this._vViewFocus, this._lensPropertyName);
      this.warnEvent(1, () => [`attach(): engine running and view attached to DOM (size`,
          options.size, `unused)`]);
      return this;
    } catch (error) {
      throw this.wrapErrorEvent(error, `attach('${options.name}' -> ${options.rootLensURI})`);
    }
  }

  _setTitle (titleKuery) {
    const newTitle = this._vViewFocus.get(titleKuery);
    if (typeof newTitle === "string") document.title = newTitle;
    else {
      this.warnEvent(1, () => [
          `Ignored a request to set document.title to non-string value:`, newTitle,
          "\n\tvia setTitleKuery:", ...dumpKuery(titleKuery),
          "\n\tUIRoot:", ...dumpObject(this._vViewFocus)]);
    }
  }
}
