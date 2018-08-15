#!/usr/bin/env vlm
global.self = global;
global.name = "Perspire window";
global.window = global;
const path = require("path");
const PerspireView = require("@valos/inspire").PerspireView;
const inspire = require("@valos/inspire");
const ReactDOM = require("react-dom").default;
const React = require("react").default;

exports.command = "perspire [revelationPath]";
exports.describe = "headless server-side environment";

exports.disabled = (yargs) => !yargs.vlm.packageConfig;
exports.builder = (yargs) => yargs.options({});

exports.handler = (yargv) => {
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
              container: global.window,
              rootId: "valaa-inspire--main-root",
              size: {
                width: global.window.innerWidth,
                height: global.window.innerHeight,
                scale: 1
              },
            },
          },
            (options) => new PerspireView(options));
          });
          perspireEngine.perspireMain.then(p => console.log("perspire", p));
        });
  }
};
