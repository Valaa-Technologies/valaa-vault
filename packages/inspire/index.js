// @flow

// TODO(iridian): @valos/inspire entry is possibly not the appropriate place for babel-polyfill:
// at the moment it still is the top level entry point, but this might change.
import "@babel/polyfill";
import injectTapEventPlugin from "react-tap-event-plugin";

import { getURIQueryField } from "~/raem/tools/PartitionURI";

import InspireGateway from "~/inspire/InspireGateway";
import { combineRevelationsLazily } from "~/inspire/Revelation";

import revelationTemplate from "~/inspire/revelation.template";

import { exportValaaPlugin, getGlobal, Logger, LogEventGenerator, outputError }
    from "~/tools";

import * as mediaDecoders from "./mediaDecoders";
import "./inspire.css";
export { default as PerspireView } from "./PerspireView";

injectTapEventPlugin();

const logger = new Logger();

const Valaa = getGlobal().Valaa || (getGlobal().Valaa = {});

Valaa.getURIQueryField = getURIQueryField;


Valaa.createInspireGateway = function createInspireGateway (...revelations: any[]) {
  const gatewayPromise = Valaa.createGateway(...revelations);
  return new Promise(resolve =>
      document.addEventListener("DOMContentLoaded", () => { resolve(gatewayPromise); }));
};

Valaa.createPerspireGateway = function createPerspire (...revelations: any[]) {
  return Valaa.createGateway(...revelations);
};

export default (Valaa.createGateway = async function createGateway (...revelations: any) {
  let ret;
  let combinedRevelation;
  const delayedPlugins = [];
  try {
    exportValaaPlugin({ name: "@valos/inspire", mediaDecoders });
    if (Valaa.gateway) {
      throw new Error(`Valaa.gateway already exists (${
          Valaa.gateway.debugId()}). There can be only one.`);
    }

    const gatewayPluginsRevelation = {
      gateway: {
        plugins: Valaa.plugins,
        scribe: {
          getDatabaseAPI: (!global.process
              ? require("~/tools/indexedDB/getBrowserDatabaseAPI")
              : require("~/tools/indexedDB/getWebSQLShimDatabaseAPI"))
            .getDatabaseAPI,
        }
      }
    };

    Valaa.plugins = { push (plugin) { delayedPlugins.push(plugin); } };

    ret = new InspireGateway({ name: "Uninitialized InspireGateway", logger });
    ret.warnEvent(`Initializing in environment (${
        String(process.env.NODE_ENV)}) by combining`, ...revelations, gatewayPluginsRevelation);

    combinedRevelation = await combineRevelationsLazily(
        ret,
        revelationTemplate,
        ...revelations,
        gatewayPluginsRevelation);

    await ret.initialize(combinedRevelation);

    Valaa.gateway = ret;
    ret.warnEvent(`InspireGateway set to window.Valaa.gateway as`, ret);

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
