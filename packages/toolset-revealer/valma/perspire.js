#!/usr/bin/env vlm
global.self = global;
global.name = "Perspire window";
global.window = global;
const path = require("path");
const PerspireView = require("@valos/inspire").PerspireView;
const JSDOM = require("jsdom").JSDOM;

const container = new JSDOM(`
  <div id="valaa-inspire--main-container"></div>
`, { pretendToBeVisual: true });
const meta = container.window.document.createElement("meta");
meta.httpEquiv = "refresh";
meta.content = "1";
container.window.document.getElementsByTagName("head")[0].appendChild(meta);

exports.command = "perspire [revelationPath]";
exports.describe = "headless server-side environment";

exports.disabled = (yargs) => !yargs.vlm.packageConfig;
exports.builder = (yargs) => yargs.option({
  output: {
    type: "string",
    default: "",
    description: "Outputs rendered HTML to a file"
  }
});

exports.handler = async (yargv) => {
  // Example template which displays the command name itself and package name where it is ran
  // Only enabled inside package
  const vlm = yargv.vlm;
  const revelationPath = yargv.revelationPath || "./valaa.json";

  if (!vlm.shell.test("-f", revelationPath)) {
    vlm.info(`file not found ${revelationPath}`);
  } else {
    const revelation = require(path.join(process.cwd(), revelationPath));
    global.revelationPath = path.dirname(revelationPath);
    const perspire = Valaa.createPerspireGateway(revelation)
        .then((gateway) => {
          const perspireEngine = gateway.createAndConnectViewsToDOM({
            perspireMain: {
              name: "Valaa Local Perspire Main",
              rootLensURI: gateway.getRootPartitionURI(),
              window: container.window,
              container: container.window.document.querySelector("#valaa-inspire--main-container"),
              rootId: "valaa-inspire--main-root",
              size: {
                width: container.window.innerWidth,
                height: container.window.innerHeight,
                scale: 1
              },
            },
          },
            (options) => new PerspireView(options));
        });
    container.window.setInterval(() => {
      if (yargv.output) {
        vlm.shell.ShellString(container.serialize()).to(yargv.output);
      }
    }, 1000); // keeps jsDom alive
  }
};
