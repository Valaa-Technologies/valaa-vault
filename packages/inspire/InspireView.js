// @flow

import { dumpKuery, dumpObject } from "~/engine/VALEK";
import VDOMView from "~/inspire/VDOMView";

/**
 * This class is the view entry point
 */
export default class InspireView extends VDOMView {
  async attach (container, options) {
    const ret = super.attach(container, options);
    if (options.setTitleKuery) {
      this._setTitle(options.setTitleKuery);
    }
    this.warnEvent(1, () => [
      `attach(): engine running and view attached to DOM (size`, options.size, `unused)`,
    ]);
    return ret;
  }

  _setTitle (titleKuery) {
    const newTitle = this._vFocus.get(titleKuery);
    if (typeof newTitle === "string") document.title = newTitle;
    else {
      this.warnEvent(1, () => [
          `Ignored a request to set document.title to non-string value:`, newTitle,
          "\n\tvia setTitleKuery:", ...dumpKuery(titleKuery),
          "\n\tfocus:", ...dumpObject(this._vFocus)]);
    }
  }
}
