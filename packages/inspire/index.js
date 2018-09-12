// @flow

// TODO(iridian): @valos/inspire entry is possibly not the appropriate place for babel-polyfill:
// at the moment it still is the top level entry point, but this might change.
import "@babel/polyfill";
import { getURIQueryField } from "~/raem/ValaaURI";

import InspireGateway from "~/inspire/InspireGateway";
import { combineRevelationsLazily } from "~/inspire/Revelation";

import revelationTemplate from "~/inspire/revelation.template";

import {
  exportValaaPlugin, dumpObject, getGlobal, Logger, LogEventGenerator, outputError, inBrowser
} from "~/tools";

import * as mediaDecoders from "./mediaDecoders";

if (inBrowser()) {
  require("./inspire.css");
}

const logger = new Logger();

const Valaa = getGlobal().Valaa || (getGlobal().Valaa = {});

Valaa.getURIQueryField = getURIQueryField;


Valaa.createInspireGateway = function createInspireGateway (...revelations: any[]) {
  const inspireBrowserEnvironmentRevelation = {
    gateway: { scribe: {
      getDatabaseAPI: require("~/tools/indexedDB/getBrowserDatabaseAPI").getDatabaseAPI,
    }, },
  };

  const gatewayPromise = Valaa.createGateway(
      { revelationSiteRootPath: window.location.pathname },
      ...revelations, inspireBrowserEnvironmentRevelation);
  return new Promise(resolve =>
      document.addEventListener("DOMContentLoaded", () => { resolve(gatewayPromise); }));
};

export default (Valaa.createGateway = async function createGateway (gatewayOptions: Object = {},
    ...revelations: any) {
  let ret;
  let combinedRevelation;
  const delayedPlugins = [];
  try {
    exportValaaPlugin({ name: "@valos/inspire", mediaDecoders });
    if (Valaa.gateway) {
      throw new Error(`Valaa.gateway already exists (${
          Valaa.gateway.debugId()}). There can be only one.`);
    }

    const gatewayPluginsRevelation = { gateway: { plugins: Valaa.plugins } };

    Valaa.plugins = { push (plugin) { delayedPlugins.push(plugin); } };

    ret = new InspireGateway({ name: "Uninitialized InspireGateway", logger, ...gatewayOptions });
    ret.warnEvent(`Initializing in environment (${
        String(process.env.NODE_ENV)}) by combining`,
            ...([].concat(...revelations.map(dumpObject))),
            ...dumpObject(gatewayPluginsRevelation));

    combinedRevelation = await combineRevelationsLazily(
        ret,
        revelationTemplate,
        ...revelations,
        gatewayPluginsRevelation);

    await ret.initialize(combinedRevelation);

    Valaa.gateway = ret;
    ret.warnEvent(`InspireGateway set to window.Valaa.gateway as`, ...dumpObject(ret));

    while (delayedPlugins.length) await ret.attachPlugins(delayedPlugins.splice(0));
    Valaa.plugins = { push (plugin) { ret.attachPlugin(plugin); } };

    return ret;
  } catch (error) {
    outputError((ret || new LogEventGenerator(logger)).wrapErrorEvent(error,
        `createInspireGateway(), with`,
            "\n\trevelation components:", revelations,
            "\n\tcombined revelation:", combinedRevelation));
    throw new Error("Failed to initialize Inspire Client. See message log for more details.");
  }
});
