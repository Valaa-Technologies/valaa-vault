// @flow

import { JSDOM } from "jsdom";
import path from "path";

import createGateway from "~/inspire";
import PerspireView from "~/inspire/PerspireView";
import { invariantifyString, wrapError } from "~/tools";

export default class PerspireServer {
  constructor ({
    isTest, logger, siteRoot, domainRoot, revelationRoot, revelations, cacheBasePath, spindles,
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
    this.spindles = spindles;
  }

  async initialize () {
    global.window = global.self = global;
    // Load global node context polyfills and libraries
    global.WebSocket = require("ws");
    global.fetch = require("node-fetch");
    global.Headers = global.fetch.Headers;
    global.Request = global.fetch.Request;
    global.Response = global.fetch.Response;
    global.atob = (str) => Buffer.from(str, "base64").toString("binary");
    global.btoa = (str) => Buffer.from(str, "binary").toString("base64");

    (this.spindles || []).forEach(spindle => {
      try {
        return require(spindle);
      } catch (error) {
        throw wrapError(error,
            new Error(`During PerspireServer.initialize.require("${spindle}")`));
      }
    });

    return (this.gateway =
        (!this.isTest
            ? this._createWorkerPerspireGateway(this.gatewayOptions, ...this.revelations)
            : this._createTestPerspireGateway(this.gatewayOptions, ...this.revelations))
        .then(gateway => (this.gateway = gateway)));
  }

  async createMainView () {
    global.name = "Perspire window";

    this.jsdom = new JSDOM(`<div id="perspire-gateway--main-container"></div>`,
        { pretendToBeVisual: true });
    const viewWindow = this.jsdom.window;
    const meta = viewWindow.document.createElement("meta");
    meta.httpEquiv = "refresh";
    meta.content = "1";
    viewWindow.document.getElementsByTagName("head")[0].appendChild(meta);
    this.container = viewWindow.document.querySelector("#perspire-gateway--main-container");

    // re-set after jsdom is set
    global.window = viewWindow;
    global.document = viewWindow.document;
    global.navigator = viewWindow.navigator;
    global.HTMLIFrameElement = viewWindow.HTMLIFrameElement;

    global.requestAnimationFrame = viewWindow.requestAnimationFrame =
        (callback) => { setTimeout(callback, 0); };
    global.cancelAnimationFrame = viewWindow.cancelAnimationFrame =
        (callback) => { setTimeout(callback, 0); };

    const views = (await this.gateway).createAndConnectViewsToDOM({
      worker: {
        name: "ValOS Perspire Worker",
        lensURI: this.gateway.getRootLensURI(),
        lensPropertyFallbacks: ["WORKER_LENS"],
        hostGlobal: global,
        window: viewWindow,
        container: this.container,
        viewRootId: "perspire-gateway--worker-view",
        size: {
          width: viewWindow.innerWidth,
          height: viewWindow.innerHeight,
          scale: 1
        },
      },
    }, (options) => new PerspireView(options));
    const worker = await views.worker;
    this.valos = worker.rootScope.valos;
    // Creating perspire specific objects and variables.
    // Please use server.valos.Perspire for external packages
    this.valos.views = views;
    this.valos.Perspire = {};
    this.valos.isServer = true;
    return worker;
  }

  async run (interval: number, heartbeat: Function, options: Object) {
    return new Promise((resolve, reject) => {
      let index = 0;
      if (options.tickOnceImmediately && !callback()) return;
      const timeoutObject = this.jsdom.window.setInterval(callback, interval * 1000);
      function callback () {
        try {
          const ret = heartbeat(index++);
          if (ret === undefined) return true;
          resolve(ret);
        } catch (error) {
          reject(error);
        }
        if (timeoutObject) this.jsdom.window.clearInterval(timeoutObject);
        return false;
      }
    });
  }

  async terminate () {
    return this.gateway && this.gateway.terminate();
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
