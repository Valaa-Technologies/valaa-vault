// @flow

// TODO(iridian): @valos/inspire entry is possibly not the appropriate place for babel-polyfill:
// at the moment it still is the top level entry point, but this might change.
import "@babel/polyfill";
import { getURIQueryField } from "~/raem/ValaaURI";

import Gateway from "~/inspire/Gateway";
import { lazyPatchRevelations, lazy } from "~/inspire/Revelation";

import revelationTemplate from "~/inspire/revelation.template";

import { dumpify, dumpObject, outputError, inBrowser, valosheath } from "~/tools";
import { setGlobalLogger } from "~/tools/wrapError";

import * as mediaDecoders from "./mediaDecoders";

export { lazy };

if (inBrowser()) {
  require("./inspire.css");
  require("./simplebar.min.css");
}

// TODO(iridian, 2018-12): Oof... this should be moved to @valos/raem
// spindle initializer. This requires spindle initializers though which
// don't exist.
// TODO(iridian, 2019-09): They do now though. See attachSpawn
valosheath.getURIQueryField = getURIQueryField;

valosheath.createInspireGateway = function createInspireGateway (...revelations: any[]) {
  const inspireBrowserEnvironmentRevelation = {
    gateway: { scribe: {
      getDatabaseAPI: require("~/tools/indexedDB/getBrowserDatabaseAPI").getDatabaseAPI,
    }, },
  };

  const gatewayPromise = valosheath.createGateway({
    siteRoot: "/", // TODO(iridian, 2018-12): provide this somehow via index.html
    revelationRoot: window.location.pathname,
  }, ...revelations, inspireBrowserEnvironmentRevelation);
  return new Promise(resolve =>
      document.addEventListener("DOMContentLoaded", () => { resolve(gatewayPromise); }));
};

export default (valosheath.createGateway = async function createGateway (
    gatewayOptions: Object = {}, ...revelations: any) {
  const ret = new Gateway({ name: "Uninitialized Gateway", ...gatewayOptions });
  let combinedRevelation;
  const delayedSpindlePrototypes = [];
  try {
    setGlobalLogger(ret);

    valosheath.exportSpindle({ name: "@valos/inspire", mediaDecoders });
    if (valosheath.gateway) {
      throw new Error(`valos.gateway already exists as ${
          valosheath.gateway.debugId()}. There can be only one.`);
    }

    const spindlesRevelation = { gateway: { spindlePrototypes: valosheath.spindlePrototypes } };

    valosheath.spindlePrototypes = {
      push (spindlePrototype) { delayedSpindlePrototypes.push(spindlePrototype); }
    };

    valosheath.require = ret.require.bind(ret);

    ret.clockEvent(1, `gateway.revelations`, `Preparing revelations in environment (${
        String(process.env.NODE_ENV)})`);
    ret.warnEvent(1, () => [
      `Combining ${revelations.length} revelations:`,
      ...[].concat(...revelations.map(revelation => dumpify(revelation))),
      "\n\tand the spindlesRevelation:", ...dumpObject(spindlesRevelation),
    ]);

    combinedRevelation = await lazyPatchRevelations(
        ret,
        {},
        revelationTemplate,
        ...revelations,
        spindlesRevelation);

    ret.clockEvent(1, `gateway.initialize`, `Initializing gateway`);
    await ret.initialize(combinedRevelation);

    valosheath.gateway = ret;
    ret.warnEvent(1, () => [`Gateway set to window.valos.gateway as`, ...dumpObject(ret)]);

    ret.clockEvent(1, `gateway.spindles.delayed.attach`, `Attaching ${
        delayedSpindlePrototypes.length} delayed second stage spindles`);
    while (delayedSpindlePrototypes.length) {
      await ret.attachSpindles(delayedSpindlePrototypes.splice(0));
    }
    valosheath.spindlePrototypes = {
      push (spindlePrototype) { ret.attachSpindle(spindlePrototype); },
    };

    ret.clockEvent(1, "gateway.initialized");
    return ret;
  } catch (error) {
    outputError(ret.wrapErrorEvent(error, 1,
            new Error(`createGateway()`),
            "\n\trevelation components:", revelations,
            "\n\tcombined revelation:", combinedRevelation),
        "Exception caught during createGateway");
    throw new Error("Failed to initialize Inspire Client. See message log for more details.");
  }
});
