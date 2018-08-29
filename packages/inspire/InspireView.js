// @flow

import { dumpKuery, dumpObject } from "~/engine/VALEK";
import VDOMView from "~/inspire/VDOMView";

/**
 * This class is the view entry point
 */
export default class InspireView extends VDOMView {
  async attach (options : Object) {
    await super.attach(options);
    try {
      if (options.setTitleKuery) this._setTitle(options.setTitleKuery);

      // Renderer
      await this._createReactRoot(options.rootId, window, options.container, this._vViewFocus,
          options.name);
      this.warnEvent(`attach(): engine running and view attached to DOM (size`,
          options.size, `unused)`);
      return this;
    } catch (error) {
      throw this.wrapErrorEvent(error, `attach('${options.name}' -> ${options.rootLensURI})`);
    }
  }

  _setTitle (titleKuery) {
    const newTitle = this._vViewFocus.get(titleKuery);
    if (typeof newTitle === "string") document.title = newTitle;
    else {
      this.warnEvent(`Ignored a request to set document.title to non-string value:`, newTitle,
          "\n\tvia setTitleKuery:", ...dumpKuery(titleKuery),
          "\n\tUIRoot:", ...dumpObject(this._vViewFocus));
    }
  }
}
