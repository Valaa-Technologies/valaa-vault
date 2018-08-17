#!/usr/bin/env vlm

// some web to node env emulation
global.self = global;
global.name = "Perspire window";
global.window = global;

const PerspireServer = require("@valos/inspire/PerspireServer").default;

exports.command = "perspire [revelationPath]";
exports.describe = "headless server-side environment";

exports.disabled = (yargs) => !yargs.vlm.packageConfig;
exports.builder = (yargs) => yargs.option({
  output: {
    type: "string",
    default: "",
    description: "Outputs rendered HTML to a file"
  },
  keepalive: {
    type: "boolean",
    default: true,
    description: "Keeps server alive after initial run"
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
    const server = new PerspireServer(yargv);
    server.start();
  }
};
