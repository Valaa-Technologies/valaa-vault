const getGlobal = require("~/tools/getGlobal").default;
const inBrowser = require("~/tools/inBrowser").default;

/**
 * The global Valaa namespace object is a shared by protected namespace
 * for cross-communication between ValOS fabric, gateway and ValaaSpace
 * resources.
 * It is available in fabric side via preferred directive:
 * `import Valaa from "@valos/tools/Valaa";`
 * or directly by `window.Valaa` or `global.Valaa` (will not be
 * deprecated, but discouraged).
 * It is available in ValaaSpace side as the global Valaa object.
 */
export default (getGlobal().Valaa || (getGlobal().Valaa = {
  gateway: null,

  require (module) {
    if (!inBrowser()) return require(module);
    throw new Error(`Cannot Valaa.require requested module "${
        module}": no Valaa.gateway found in browser context`);
  },

  /**
   * Adds the given plugin to the global Valaa.plugins; this makes the
   * plugin available to:
   * 1. the Valaa application gateway itself, introducing schemas,
   *    schemes, decoders etc.
   * 2. the Valaa fabric, ie. javascript-side code, libraries and
   *    for other plugins by using import Valaa directive (preferred) or
   *    directly through global.Valaa or window.Valaa
   * 3. the ValaaSpace applications, via its global.Valaa
   *
   * Plugin loading has three phases.
   * 1. First phase plugins are those that were exported to Valaa.plugins
   *    before gateway initialization. They are attached immediately
   *    after gateway creation and are available during the remainder of
   *    gateway initialization (this including gateway prologue
   *    narrations).
   * 2. Second phase plugins are those that are pushed to Valaa.plugins
   *    during gateway initialization. They are attached only after init
   *    is complete but before views are created.
   *    They are thus not available during revelation prologue narration,
   *    but are available when engine or user interfaces are deployed.
   * 3. Third phase plugins are those which are pushed to Valaa.plugins
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
