// @flow

// TODO(iridian): @valos/inspire entry is possibly not the appropriate place for babel-polyfill:
// at the moment it still is the top level entry point, but this might change.
import "@babel/polyfill";
import { getURIQueryField } from "~/raem/ValaaURI";

import Gateway from "~/inspire/Gateway";
import { combineRevelationsLazily } from "~/inspire/Revelation";

import revelationTemplate from "~/inspire/revelation.template";

import { dumpify, dumpObject, FabricEventLogger, FabricEventTarget, outputError, inBrowser, valos }
    from "~/tools";

import * as mediaDecoders from "./mediaDecoders";

if (inBrowser()) {
  require("./inspire.css");
  require("./simplebar.min.css");
}

const logger = new FabricEventLogger();

// TODO(iridian, 2018-12): Oof... this should be moved to @valos/raem
// spindle initializer. This requires spindle initializers though which
// don't exist.
// TODO(iridian, 2019-09): They do now though. See attachSpawn
valos.getURIQueryField = getURIQueryField;

valos.createInspireGateway = function createInspireGateway (...revelations: any[]) {
  const inspireBrowserEnvironmentRevelation = {
    gateway: { scribe: {
      getDatabaseAPI: require("~/tools/indexedDB/getBrowserDatabaseAPI").getDatabaseAPI,
    }, },
  };

  const gatewayPromise = valos.createGateway({
    siteRoot: "/", // TODO(iridian, 2018-12): provide this somehow via index.html
    revelationRoot: window.location.pathname,
  }, ...revelations, inspireBrowserEnvironmentRevelation);
  return new Promise(resolve =>
      document.addEventListener("DOMContentLoaded", () => { resolve(gatewayPromise); }));
};

export default (valos.createGateway = async function createGateway (gatewayOptions: Object = {},
    ...revelations: any) {
  let ret;
  let combinedRevelation;
  const delayedSpindlePrototypes = [];
  try {
    valos.exportSpindle({ name: "@valos/inspire", mediaDecoders });
    if (valos.gateway) {
      throw new Error(`valos.gateway already exists as ${
          valos.gateway.debugId()}. There can be only one.`);
    }

    const spindlesRevelation = { gateway: { spindlePrototypes: valos.spindlePrototypes } };

    valos.spindlePrototypes = {
      push (spindlePrototype) { delayedSpindlePrototypes.push(spindlePrototype); }
    };

    ret = new Gateway({ name: "Uninitialized Gateway", logger, ...gatewayOptions });
    valos.require = ret.require.bind(ret);

    ret.clockEvent(1, `gateway.revelations`, `Preparing revelations in environment (${
        String(process.env.NODE_ENV)})`);
    ret.warnEvent(0, () => [
      `Combining ${revelations.length} revelations:`,
      ...[].concat(...revelations.map(revelation => dumpify(revelation))),
      "\n\tand the spindlesRevelation:", ...dumpObject(spindlesRevelation),
    ]);

    combinedRevelation = await combineRevelationsLazily(
        ret,
        revelationTemplate,
        ...revelations,
        spindlesRevelation);

    ret.clockEvent(1, `gateway.initialize`, `Initializing gateway`);
    await ret.initialize(combinedRevelation);

    valos.gateway = ret;
    ret.warnEvent(`Gateway set to window.valos.gateway as`, ...dumpObject(ret));

    ret.clockEvent(1, `gateway.spindles.delayed.attach`, `Attaching ${
        delayedSpindlePrototypes.length} delayed second stage spindles`);
    while (delayedSpindlePrototypes.length) {
      await ret.attachSpindles(delayedSpindlePrototypes.splice(0));
    }
    valos.spindlePrototypes = { push (spindlePrototype) { ret.attachSpindle(spindlePrototype); } };

    ret.clockEvent(1, "gateway.initialized");
    return ret;
  } catch (error) {
    outputError((ret || new FabricEventTarget(logger)).wrapErrorEvent(error,
            new Error(`createGateway()`),
            "\n\trevelation components:", revelations,
            "\n\tcombined revelation:", combinedRevelation),
        "Exception caught during createGateway");
    throw new Error("Failed to initialize Inspire Client. See message log for more details.");
  }
});
