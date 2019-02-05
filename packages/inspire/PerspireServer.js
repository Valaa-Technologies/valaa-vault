// @flow

import { JSDOM } from "jsdom";
import WebSocket from "ws"; // For networking in Node environments
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
    isTest, revelationRoot, revelations, pluginPaths, cacheRoot, outputPath, jsdom, container,
  }: Object) {
    invariantifyString(revelationRoot, "PerspireServer.options.revelationRoot",
        { allowEmpty: true });
    this.isTest = isTest;
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
    this.jsdom = jsdom;
    this.container = container;
  }

  async start () {
    (this.pluginPaths || []).forEach(pluginPath => require(path.join(process.cwd(), pluginPath)));

    return (this.gateway = (!this.isTest
        ? _createPerspireGateway
        : _createTestPerspireGateway)(this.gatewayOptions, ...this.revelations)
    .then(async (gateway) => {
      const viewOptions = {
        perspireMain: {
          name: "Valaa Local Perspire Main",
          rootLensURI: gateway.getRootPartitionURI(),
          window: this.jsdom.window,
          container: this.container,
          rootId: "perspire-gateway--main-root",
          size: {
            width: this.jsdom.window.innerWidth,
            height: this.jsdom.window.innerHeight,
            scale: 1
          },
        },
      };
      const views = gateway.createAndConnectViewsToDOM(
          viewOptions, (options) => new PerspireView(options));
      await views.perspireMain;
      this.serializeToOutputPath();
      this.gateway = gateway;
      this.Valaa = views.perspireMain.rootScope.Valaa;
      return gateway;
    }));
  }

  async run (interval: number) {
    return new Promise((/* terminate */) => {
      this.jsdom.window.setInterval(() => {
        this.serializeToOutputPath();
      }, interval * 1000);
    });
  }

  serializeMainDOM () {
    return this.jsdom.serialize();
  }

  serializeToOutputPath () {
    if (this.outputPath) {
      shell.ShellString(this.jsdom.serialize()).to(this.outputPath);
    }
  }
}

export async function startNodePerspireServer ({
  isTest, revelationRoot, revelations, databaseBasePath, pluginPaths, outputPath,
}: Object) {
  // for jsdom.
  global.self = global;
  global.name = "Perspire window";
  global.window = global;
  global.WebSocket = WebSocket;
  global.fetch = require("node-fetch");

  const jsdom = new JSDOM(`<div id="perspire-gateway--main-container"></div>`,
      { pretendToBeVisual: true });
  const meta = jsdom.window.document.createElement("meta");
  meta.httpEquiv = "refresh";
  meta.content = "1";
  jsdom.window.document.getElementsByTagName("head")[0].appendChild(meta);

  // re-set after jsdom is set
  global.window = jsdom.window;
  global.document = jsdom.window.document;
  global.navigator = jsdom.window.navigator;
  global.HTMLIFrameElement = jsdom.window.HTMLIFrameElement;
  global.requestAnimationFrame = (callback) => { setTimeout(callback, 0); };
  global.cancelAnimationFrame = (callback) => { setTimeout(callback, 0); };

  const server = new PerspireServer({
    isTest, revelationRoot, pluginPaths, outputPath, jsdom,
    container: jsdom.window.document.querySelector("#perspire-gateway--main-container"),
    revelations: [
      { gateway: {
          scribe: {
            databaseConfig: {
              // See https://github.com/axemclion/IndexedDBShim for config options
              databaseBasePath,
              checkOrigin: false,
      } } } },
      ...revelations,
    ],
  });
  await server.start();

  // Creating perspire specific objects and variables.
  // Please use server.Valaa.Perspire for external packages
  server.Valaa.Perspire = {};
  server.Valaa.isServer = true;
  return server;
}
