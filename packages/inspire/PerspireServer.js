// @flow

import path from "path";
import { PerspireView, createPerspireGateway } from "~/inspire";
import { JSDOM } from "jsdom";
import shell from "shelljs";


export default class PerspireServer {
  constructor ({ vlm, revelationPath, output, keepalive = true,
    container = () => {
      const ret = new JSDOM(`
        <div id="valaa-inspire--main-container"></div>
        `, { pretendToBeVisual: true });
      const meta = ret.window.document.createElement("meta");
      meta.httpEquiv = "refresh";
      meta.content = "1";
      ret.window.document.getElementsByTagName("head")[0].appendChild(meta);
      return ret;
    } } : Object) {
    this.vlm = vlm;
    this.revelationPath = revelationPath;
    this.output = output;
    this.keepalive = keepalive;
    this.container = container();
  }

  start () {
    global.revelationPath = path.dirname(this.revelationPath);
    global.document = this.container.window.document;
    this.revelation = require(path.join(process.cwd(), this.revelationPath));
    window.WebSocket = require("ws"); // for aws plugin
    this.gateway = createPerspireGateway(this.revelation)
          .then((gateway) => {
            gateway.createAndConnectViewsToDOM({
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
            },
            (options) => new PerspireView(options));
          });
    if (this.keepalive) {
      this.container.window.setInterval(() => {
        if (this.output) {
          shell.ShellString(this.container.serialize()).to(this.output);
        }
      }, 1000); // keeps jsDom alive
    } else {
      if (this.output) {
        shell.ShellString(this.container.serialize()).to(this.output);
      }
      this.gateway.then((res) => this);
    }
  }
}
