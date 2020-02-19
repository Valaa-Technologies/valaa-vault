// @flow

import "@babel/polyfill";
import VDOMView from "~/inspire/VDOMView";

/**
 * This class is the view entry point
 */
export default class PerspireView extends VDOMView {
  async attach (container, options) {
    const ret = await super.attach(container, options);
    if (options.window) {
      global.window = options.window; // makes sure that React will use correct window
      global.window.alert = (...rest) => this.warnEvent("window.alert:", ...rest);
    }
    await this._waitForConnectionsToActivate();
    this.warnEvent(1, () => [
      `attach(): engine running, view attached to DOM and all initial UI chronicle${
        ""} connections complete`,
    ]);
    return ret;
  }

  async _waitForConnectionsToActivate () {
    let pendingConnections;
    while (true) { // eslint-disable-line no-constant-condition
      pendingConnections = this._vFocus.engine.getSourcerer().getActivatingConnections();
      const keys = Object.keys(pendingConnections);
      if (!keys.length) break;
      this.warnEvent(1, () => [
        `attach(): acquiring pending UI-initiated connections:`, ...keys,
      ]);
      await Promise.all(Object.values(pendingConnections));
    }
    this.warnEvent(1, () => [
      `attach(): all connections acquired:`,
      ...Object.values(this._vFocus.engine.getSourcerer().getActiveConnections())
          .map(connection => `\n\t${connection.debugId()}`),
    ]);
  }
}
