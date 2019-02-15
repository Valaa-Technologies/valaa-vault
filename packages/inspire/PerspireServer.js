// @flow

import { JSDOM } from "jsdom";
import WebSocket from "ws"; // For networking in Node environments
import path from "path";

import createGateway from "~/inspire";
import PerspireView from "~/inspire/PerspireView";
import { invariantifyString } from "~/tools";

export default class PerspireServer {
  constructor ({
    isTest, logger, siteRoot, domainRoot, revelationRoot, revelations, cacheBasePath, plugins,
  }: Object) {
    invariantifyString(revelationRoot, "PerspireServer.options.revelationRoot",
        { allowEmpty: true });
    this.isTest = isTest;
    this.gatewayOptions = {
      logger,
      siteRoot,
      domainRoot,
      revelationRoot: revelationRoot[0] === "/"
          ? revelationRoot
          : path.join(siteRoot, revelationRoot),
    };

    this.revelations = revelations || [];
    this.cacheBasePath = cacheBasePath;
    this.plugins = plugins;
  }

  async initialize () {
    (this.plugins || []).forEach(plugin => require(plugin));
    return (this.gateway =
        (!this.isTest
            ? this._createWorkerPerspireGateway(this.gatewayOptions, ...this.revelations)
            : this._createTestPerspireGateway(this.gatewayOptions, ...this.revelations))
        .then(gateway => (this.gateway = gateway)));
  }

  async createMainView () {
    global.self = global;
    global.name = "Perspire window";
    global.window = global;
    global.WebSocket = WebSocket;
    global.fetch = require("node-fetch");

    this.jsdom = new JSDOM(`<div id="perspire-gateway--main-container"></div>`,
        { pretendToBeVisual: true });
    const meta = this.jsdom.window.document.createElement("meta");
    meta.httpEquiv = "refresh";
    meta.content = "1";
    this.jsdom.window.document.getElementsByTagName("head")[0].appendChild(meta);
    this.container = this.jsdom.window.document.querySelector("#perspire-gateway--main-container");

    // re-set after jsdom is set
    global.window = this.jsdom.window;
    global.document = this.jsdom.window.document;
    global.navigator = this.jsdom.window.navigator;
    global.HTMLIFrameElement = this.jsdom.window.HTMLIFrameElement;
    global.requestAnimationFrame = (callback) => { setTimeout(callback, 0); };
    global.cancelAnimationFrame = (callback) => { setTimeout(callback, 0); };

    const views = (await this.gateway).createAndConnectViewsToDOM({
      perspireMain: {
        name: "Valaa Local Perspire Main",
        rootLensURI: this.gateway.getRootPartitionURI(),
        window: this.jsdom.window,
        container: this.container,
        rootId: "perspire-gateway--main-root",
        size: {
          width: this.jsdom.window.innerWidth,
          height: this.jsdom.window.innerHeight,
          scale: 1
        },
      },
    }, (options) => new PerspireView(options));
    const ret = await views.perspireMain;
    this.Valaa = views.perspireMain.rootScope.Valaa;
    // Creating perspire specific objects and variables.
    // Please use server.Valaa.Perspire for external packages
    this.Valaa.Perspire = {};
    this.Valaa.isServer = true;
    return ret;
  }

  async run (interval: number, heartbeat: Function) {
    return new Promise((resolve, reject) => {
      let index = 0;
      const timeoutObject = this.jsdom.window.setInterval(() => {
        try {
          const ret = heartbeat(index++);
          if (ret === undefined) return;
          resolve(ret);
        } catch (error) {
          reject(error);
        }
        this.jsdom.window.clearInterval(timeoutObject);
      }, interval * 1000);
    });
  }

  serializeMainDOM () {
    return this.jsdom.serialize();
  }

  _createWorkerPerspireGateway (gatewayOptions: Object, ...revelations: any[]) {
    const shimLibrary = require("~/tools/indexedDB/getWebSQLShimDatabaseAPI");

    const workerEnvironmentRevelation = {
      gateway: { scribe: {
        getDatabaseAPI () {
          shimLibrary.configure(this.databaseConfig || {});
          return shimLibrary.getDatabaseAPI();
        },
        databaseConfig: {
          // See https://github.com/axemclion/IndexedDBShim for config options
          databaseBasePath: this.cacheBasePath,
          checkOrigin: false,
        },
      } },
    };
    return createGateway(gatewayOptions, ...revelations, workerEnvironmentRevelation);
  }

  _createTestPerspireGateway (gatewayOptions: Object, ...revelations: any[]) {
    const testEnvironmentRevelation = {
      gateway: { scribe: {
        getDatabaseAPI: require("~/tools/indexedDB/getInMemoryDatabaseAPI").getDatabaseAPI,
      } },
    };
    return createGateway(gatewayOptions, ...revelations, testEnvironmentRevelation);
  }
}
