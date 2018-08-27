// @flow

import { JSDOM } from "jsdom";
import shell from "shelljs";
import { createPerspireGateway, createTestPerspireGateway } from "~/inspire";
import PerspireView from "~/inspire/PerspireView";

export default class PerspireServer {
  constructor ({
    revelations, pluginPaths, outputPath, keepalive = true, test,
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
    this.outputPath = outputPath;
    this.keepalive = (typeof keepalive === "number") ? keepalive : 1000;
    this.test = test;
    this.container = container();
  }

  async start () {
    global.document = this.container.window.document;
    window.WebSocket = require("ws"); // For networking in Node environments

    return (this.gateway = (!this.test
        ? createPerspireGateway
        : createTestPerspireGateway)(...this.revelations)
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
      if (this.keepalive) {
        // keeps jsDom alive
        this.container.window.setInterval(this.serializeToOutputPath, this.keepalive);
      }
      this.gateway = gateway;
      return gateway;
    }));
  }

  serializeMainDOM () { return this.container.serialize(); }

  serializeToOutputPath = () => {
    if (this.outputPath) {
      shell.ShellString(this.container.serialize()).to(this.outputPath);
    }
  }
}
