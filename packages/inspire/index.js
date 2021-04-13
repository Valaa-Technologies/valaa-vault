// @flow

// TODO(iridian): @valos/inspire entry is possibly not the appropriate place for babel-polyfill:
// at the moment it still is the top level entry point, but this might change.
import "@babel/polyfill";
import { getURIQueryField } from "~/raem/ValaaURI";

import Gateway from "~/inspire/Gateway";
import { lazyPatchRevelations, reveal, expose } from "~/inspire/Revelation";

import revelationTemplate from "~/inspire/revelation.template";

import { dumpify, dumpObject, outputError, inBrowser, valosheath } from "~/tools";
import { setGlobalLogger } from "~/tools/wrapError";

import * as mediaDecoders from "./mediaDecoders";

export { reveal, expose };

if (inBrowser()) {
  require("./inspire.css");
  require("./simplebar.min.css");
}

// TODO(iridian, 2018-12): Oof... this should be moved to @valos/raem
// spindle initializer. This requires spindle initializers though which
// don't exist.
// TODO(iridian, 2019-09): They do now though. See attachSpawn
valosheath.getURIQueryField = getURIQueryField;

let _gatewayPromise;
let _pendingViews;

valosheath.initialize = valosheath.createInspireGateway =
    function createInspireGateway (...revelations: any[]) {
  const inspireBrowserEnvironmentRevelation = {
    gateway: { scribe: {
      getDatabaseAPI: require("~/tools/indexedDB/getBrowserDatabaseAPI").getDatabaseAPI,
    }, },
  };

  const gatewayPromise = valosheath.createGateway({
    siteRoot: "/", // TODO(iridian, 2018-12): provide this somehow via index.html
    revelationRoot: window.location.pathname,
  }, ...revelations, inspireBrowserEnvironmentRevelation);
  _gatewayPromise = new Promise(resolve =>
      document.addEventListener("DOMContentLoaded", () => {
        resolve(gatewayPromise);
      }));
  return _gatewayPromise;
};

valosheath.attachView = function attachView (viewName, options) {
  if (!_gatewayPromise) {
    throw new Error("No valos gateway found. Maybe call valos.createInspireGateway first?");
  }
  if ((valosheath.gateway || {})._views) {
    valosheath.gateway.addView(viewName, options);
  } else if (_pendingViews) {
    _pendingViews[viewName] = options;
  } else {
    _pendingViews = { [viewName]: options };
    _gatewayPromise.then(gateway => {
      const pendingViews = _pendingViews;
      _pendingViews = null;
      return gateway.createAndConnectViewsToDOM(pendingViews);
    });
  }
};

export default (valosheath.createGateway = async function createGateway (
    gatewayOptions: Object = {}, ...revelations: any) {
  const ret = new Gateway({ name: "Uninitialized Gateway", ...gatewayOptions });
  let combinedRevelation;
  const delayedSpindlePrototypes = [];
  try {
    setGlobalLogger(ret);

    const plog = ret.opLog(1, "gateway",
        "Constructed the Gateway object");

    valosheath.exportSpindle({
      name: "@valos/inspire", mediaDecoders,
      meta: { url: typeof __dirname !== "undefined" ?  __dirname : "" },
    });
    if (valosheath.gateway) {
      throw new Error(`valos.gateway already exists as ${
          valosheath.gateway.debugId()}. There can be only one.`);
    }

    const spindlesRevelation = { gateway: { spindlePrototypes: valosheath.spindlePrototypes } };

    valosheath.spindlePrototypes = {
      push (spindlePrototype) { delayedSpindlePrototypes.push(spindlePrototype); }
    };

    valosheath.require = ret.valosRequire.bind(ret);

    plog && plog.opEvent("revelations",
        `Preparing revelations in environment (${String(process.env.NODE_ENV)})`);

    (plog || {}).v2 && plog.warnEvent(
        `Combining ${revelations.length} revelations:`,
        ...[].concat(...revelations.map(revelation => dumpify(revelation))),
        "\n\tand the spindlesRevelation:", ...dumpObject(spindlesRevelation),
    );

    combinedRevelation = await lazyPatchRevelations(
        ret,
        {},
        revelationTemplate,
        spindlesRevelation,
        ...revelations);

    await ret.initialize(combinedRevelation, plog);

    valosheath.gateway = ret;
    plog && plog.v2 && plog.warnEvent(
        `Gateway set to window.valos.gateway as`, ...dumpObject(ret));

    plog && plog.opEvent("await_delayed_attachSpindles",
        `Attaching ${delayedSpindlePrototypes.length} delayed second stage spindles`);
    while (delayedSpindlePrototypes.length) {
      await ret.attachSpindles(delayedSpindlePrototypes.splice(0), { skipIfAlreadyAttached: true });
    }
    valosheath.spindlePrototypes = {
      push (spindlePrototype) { ret.attachSpindle(spindlePrototype); },
    };

    plog && plog.opEvent("created",
        "Gateway creation done");
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
