// @flow

import { JSDOM } from "jsdom";
import shell from "shelljs";
import path from "path";
import createGateway from "~/inspire";
import PerspireView from "~/inspire/PerspireView";
import { invariantifyString } from "~/tools";

function _createPerspireGateway (gatewayOptions: Object, ...revelations: any[]) {
  const shimLibrary = require("~/tools/indexedDB/getWebSQLShimDatabaseAPI");

  const perspireEnvironmentRevelation = {
    gateway: { scribe: {
      getDatabaseAPI () {
        shimLibrary.configure(this.databaseConfig || {});
        return shimLibrary.getDatabaseAPI();
      },
    } },
  };
  return createGateway(gatewayOptions, ...revelations, perspireEnvironmentRevelation);
}

function _createTestPerspireGateway (gatewayOptions: Object, ...revelations: any[]) {
  const perspireEnvironmentRevelation = {
    gateway: { scribe: {
      getDatabaseAPI: require("~/tools/indexedDB/getInMemoryDatabaseAPI").getDatabaseAPI,
    }, },
  };
  return createGateway(gatewayOptions, ...revelations, perspireEnvironmentRevelation);
}

export default class PerspireServer {
  constructor ({
    revelationRoot, revelations, pluginPaths, cacheRoot, outputPath, test,
    container = () => {
      const ret = new JSDOM(`
        <div id="valaa-inspire--main-container"></div>
        `, { pretendToBeVisual: true });
      const meta = ret.window.document.createElement("meta");
      meta.httpEquiv = "refresh";
      meta.content = "1";
      ret.window.document.getElementsByTagName("head")[0].appendChild(meta);
      return ret;
    } }: Object,
  ) {
    invariantifyString(revelationRoot, "PerspireServer.options.revelationRoot",
        { allowEmpty: true });
    this.gatewayOptions = {
      siteRoot: process.cwd(),
      revelationRoot: revelationRoot[0] === "/"
          ? revelationRoot
          : path.join(process.cwd(), revelationRoot),
    };
    this.revelations = revelations;
    this.pluginPaths = pluginPaths;
    this.cacheRoot = cacheRoot;
    this.outputPath = outputPath;
    this.test = test;
    this.container = container();
  }

  async start () {
    global.document = this.container.window.document;
    window.WebSocket = require("ws"); // For networking in Node environments

    (this.pluginPaths || []).forEach(pluginPath => require(path.join(process.cwd(), pluginPath)));

    return (this.gateway = (!this.test
        ? _createPerspireGateway
        : _createTestPerspireGateway)(this.gatewayOptions, ...this.revelations)
    .then(async (gateway) => {
      const viewOptions = {
        perspireMain: {
          name: "Valaa Local Perspire Main",
          rootLensURI: gateway.getRootPartitionURI(),
          window: this.container.window,
          container: this.container.window.document.querySelector("#valaa-inspire--main-container"),
          rootId: "valaa-inspire--main-root",
          size: {
            width: this.container.window.innerWidth,
            height: this.container.window.innerHeight,
            scale: 1
          },
        },
      };
      const views = gateway.createAndConnectViewsToDOM(
          viewOptions, (options) => new PerspireView(options));
      await views.perspireMain;
      this.serializeToOutputPath();
      this.gateway = gateway;
      return gateway;
    }));
  }

  async run (interval: number) {
    return new Promise((/* terminate */) => {
      this.container.window.setInterval(() => {
        this.serializeToOutputPath();
      }, interval * 1000);
    });
  }

  serializeMainDOM () { return this.container.serialize(); }

  serializeToOutputPath () {
    if (this.outputPath) {
      shell.ShellString(this.container.serialize()).to(this.outputPath);
    }
  }
}
