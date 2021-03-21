// @flow

import { JSDOM } from "jsdom";
import path from "path";

import createGateway from "~/inspire";
import PerspireView from "~/inspire/PerspireView";
import { invariantifyString } from "~/tools";
import { FabricEventTarget } from "~/tools/FabricEvent";

export default class PerspireServer extends FabricEventTarget {
  constructor ({
    isTest, name, verbosity, parent,
    siteRoot, domainRoot, revelationRoot, revelations, cacheBasePath,
  }: Object) {
    invariantifyString(revelationRoot, "PerspireServer.options.revelationRoot",
        { allowEmpty: true });
    super(parent, verbosity, name);
    this.isTest = isTest;
    this.gatewayOptions = {
      parent: this,
      siteRoot,
      domainRoot,
      revelationRoot: revelationRoot[0] === "/"
          ? revelationRoot
          : (path.posix || path).join(siteRoot, revelationRoot),
    };

    this.revelations = revelations || [];
    this.cacheBasePath = cacheBasePath;
    this._spindles = [];
  }

  async initialize (spindles = []) {
    global.window = global.self = global;
    // Load global node context polyfills and libraries
    global.WebSocket = require("ws");
    global.fetch = require("node-fetch");
    global.Headers = global.fetch.Headers;
    global.Request = global.fetch.Request;
    global.Response = global.fetch.Response;
    global.atob = (str) => Buffer.from(str, "base64").toString("binary");
    global.btoa = (str) => Buffer.from(str, "binary").toString("base64");

    this.requireSpindles(spindles);

    global.name = `${this.getName()} window`;
    this._jsdom = this._createJSDOM();
    const jsdomWindow = this._jsdom.window;
    // re-set after jsdom is set
    global.window = jsdomWindow;
    global.document = jsdomWindow.document;
    global.navigator = jsdomWindow.navigator;
    global.HTMLIFrameElement = jsdomWindow.HTMLIFrameElement;

    global.requestAnimationFrame = jsdomWindow.requestAnimationFrame =
        (callback) => { setTimeout(callback, 0); };
    global.cancelAnimationFrame = jsdomWindow.cancelAnimationFrame =
        (callback) => { setTimeout(callback, 0); };
    jsdomWindow.alert = (...rest) => this.warnEvent("window.alert:", ...rest);

    return (this._gateway = (!this.isTest
        ? this._createWorkerPerspireGateway(this.gatewayOptions, ...this.revelations)
        : this._createTestPerspireGateway(this.gatewayOptions, ...this.revelations)))
    .then(gateway => {
      gateway.setupHostComponents({
        createView: (options) => new PerspireView(options),
        container: this._container,
        window: jsdomWindow,
        hostGlobal: global,
      });
      return Promise.all([gateway, ...Object.values(gateway.createAndConnectViewsToDOM())]);
    })
    .then(([gateway]) => {
      this._gateway = gateway;
      return this;
    });
  }

  requireSpindles (newSpindles = []) {
    for (const newSpindle of newSpindles) {
      if (this._spindles.includes(newSpindle)) continue;
      try {
        require(newSpindle);
        this._spindles.push(newSpindle);
      } catch (error) {
        throw this.wrapErrorEvent(error, 0,
            new Error(`During PerspireServer.requireSpindle("${newSpindle}")`),
            `\n\trequire.resolve:`, require.resolve(newSpindle));
      }
    }
  }

  _createJSDOM () {
    const ret = new JSDOM(`<div id="perspire-gateway--main-container"></div>`,
        { pretendToBeVisual: true });
    const meta = ret.window.document.createElement("meta");
    meta.httpEquiv = "refresh";
    meta.content = "1";
    ret.window.document.getElementsByTagName("head")[0].appendChild(meta);
    this._container = ret.window.document.querySelector("#perspire-gateway--main-container");
    return ret;
  }

  async createView (viewName, viewConfigAdditions = {}, parentPlog) {
    if (!this._container) throw new Error("PerspireServer hasn't been initialized yet");
    const gateway = await this._gateway;
    const viewConfig = {
      name: `${this.getName()} ${viewName}`,
      focus: gateway.getRootFocusURI(),
      viewRootId: `perspire-gateway--${viewName}-view`,
      ...viewConfigAdditions,
    };
    const view = await gateway.addView(viewName, viewConfig, parentPlog);
    // Creating perspire specific objects and variables.
    // Please use server.valos.perspire for external packages
    const perspire = { worker: this, view, viewName, viewConfig };
    Object.assign(view.getRootScope().valos, { view, perspire, Perspire: perspire });
    return view;
  }

  async terminate () {
    return this._gateway && (await this._gateway).terminate();
  }

  getGateway () { return this._gateway; }

  getRootHTML () {
    return this._jsdom.serialize();
  }

  onHTMLUpdated (callback) {
    (this._onHTMLUpdatedCallbacks || (this._onHTMLUpdatedCallbacks = []))
        .push(callback);
  }

  refreshHTML () {
    if (!this._onHTMLUpdatedCallbacks) return;
    const html = this.getRootHTML();
    if (this._currentHTML !== html) {
      this._currentHTML = html;
      this._onHTMLUpdatedCallbacks.forEach(callback => callback(html));
    }
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
        getDatabaseAPI: require("~/sourcerer/tools/getInMemoryDatabaseAPI").getDatabaseAPI,
      } },
    };
    return createGateway(gatewayOptions, ...revelations, testEnvironmentRevelation);
  }
}
