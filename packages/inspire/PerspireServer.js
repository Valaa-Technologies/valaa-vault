// @flow

import { JSDOM } from "jsdom";
import shell from "shelljs";
import path from "path";
import createGateway from "~/inspire";
import PerspireView from "~/inspire/PerspireView";

function _createPerspireGateway (...revelations: any[]) {
  const shimLibrary = require("~/tools/indexedDB/getWebSQLShimDatabaseAPI");

  const perspireEnvironmentRevelation = {
    gateway: { scribe: {
      getDatabaseAPI () {
        shimLibrary.configure(this.databaseConfig || {});
        return shimLibrary.getDatabaseAPI();
      },
    } },
  };
  return createGateway({ revelationSiteRootPath: process.cwd() },
      ...revelations, perspireEnvironmentRevelation);
}

function _createTestPerspireGateway (...revelations: any[]) {
  const perspireEnvironmentRevelation = {
    gateway: { scribe: {
      getDatabaseAPI: require("~/tools/indexedDB/getInMemoryDatabaseAPI").getDatabaseAPI,
    }, },
  };

  return createGateway({ revelationSiteRootPath: process.cwd() },
      ...revelations, perspireEnvironmentRevelation);
}

export default class PerspireServer {
  constructor ({
    revelations, pluginPaths, cacheRoot, outputPath, test,
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
        : _createTestPerspireGateway)(...this.revelations)
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
