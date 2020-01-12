const global = require("./getGlobal").default();

const inBrowser = require("./inBrowser").default;
const identity = require("./identity");

export const standalone = {
  gateway: null,

  require (module) {
    if (!inBrowser()) return require(module);
    throw new Error(`Cannot valos.require requested module "${
        module}": no valos.gateway found in browser context`);
  },

  /**
   * Adds the given spindle to the global valos.spindlePrototypes; this
   * makes the spindle available to:
   * 1. the ValOS application gateway itself, introducing schemas,
   *    schemes, decoders etc.
   * 2. the ValOS fabric, ie. javascript-side code, libraries and
   *    for other spindles by using ValOS require directive (preferred)
   *    or directly through global.valos or window.valos
   * 3. the valospace applications, via its global.valos
   *
   * Spindle loading has three phases.
   * 1. First phase spindles are those that were exported to
   *    valos.spindlePrototypes before gateway initialization. They are
   *    spawn-attached immediately after gateway creation and are
   *    available during the remainder of gateway initialization (this
   *    includes gateway prologue narrations).
   * 2. Second phase spindles are those that are pushed to
   *    valos.spindlePrototypes during gateway initialization. They are
   *    spawn-attached only after init is complete but before views are
   *    created. They are thus not available during revelation prologue
   *    narration, but are available when engine or user interfaces are
   *    deployed.
   * 3. Third phase spindles are those which are pushed to
   *    valos.spindlePrototypes at any later stage. They are
   *    spawn-attached at best-effort basis; they can thus end up being
   *    loaded even before views are attached in some circumstances.
   *
   * @export
   * @param {Object} spindlePrototype
   * @returns
   */
  exportSpindle (spindlePrototype) {
    this.spindlePrototypes.push(spindlePrototype);
    return spindlePrototype;
  },

  spindlePrototypes: [],

  identity: { ...identity },
};

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
export default (global.valos || (global.Valaa = global.valos = standalone));
