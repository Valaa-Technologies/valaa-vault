import getGlobal from "~/gateway-api/getGlobal";

const inBrowser = require("~/gateway-api/inBrowser").default;

/**
 * The global ValOS namespace object is a shared by protected namespace
 * for cross-communication between ValOS fabric, gateway and valospace
 * resources.
 * It is available in fabric side via preferred directive:
 * `const valos = require("@valos/gateway-api/valos").default;`
 * or directly by `window.valos` or `global.valos` (will not be
 * deprecated, but discouraged).
 * It is available in valospace side as the global valos object.
 */
export default (getGlobal().valos ||
    (getGlobal().Valaa = getGlobal().valos = {
  gateway: null,

  require (module) {
    if (!inBrowser()) return require(module);
    throw new Error(`Cannot valos.require requested module "${
        module}": no valos.gateway found in browser context`);
  },

  /**
   * Adds the given plugin to the global valos.plugins; this makes the
   * plugin available to:
   * 1. the ValOS application gateway itself, introducing schemas,
   *    schemes, decoders etc.
   * 2. the ValOS fabric, ie. javascript-side code, libraries and
   *    for other plugins by using ValOS require directive (preferred)
   *    or directly through global.valos or window.valos
   * 3. the valospace applications, via its global.valos
   *
   * Plugin loading has three phases.
   * 1. First phase plugins are those that were exported to valos.plugins
   *    before gateway initialization. They are attached immediately
   *    after gateway creation and are available during the remainder of
   *    gateway initialization (this including gateway prologue
   *    narrations).
   * 2. Second phase plugins are those that are pushed to valos.plugins
   *    during gateway initialization. They are attached only after init
   *    is complete but before views are created.
   *    They are thus not available during revelation prologue narration,
   *    but are available when engine or user interfaces are deployed.
   * 3. Third phase plugins are those which are pushed to valos.plugins
   *    at any later stage. They are loaded at best-effort basis; they
   *    can thus end up being loaded even before views are attached in
   *    some circumstances.
   *
   * @export
   * @param {Object} plugin
   * @returns
   */
  exportPlugin (plugin) {
    this.plugins.push(plugin);
    return plugin;
  },
  plugins: [],
}));
