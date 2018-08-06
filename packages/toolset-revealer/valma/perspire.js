#!/usr/bin/env vlm

global.window = global;
const path = require("path");
const inspire = require("@valos/inspire");

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
    process.exit();
  } else {
    const revelation = require(path.join(process.cwd(), revelationPath));
    global.revelationPath = path.dirname(revelationPath);
    const perspire = inspire.default(revelation);
  }
};
