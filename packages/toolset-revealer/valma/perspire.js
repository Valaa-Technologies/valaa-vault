#!/usr/bin/env vlm

global.window = global;
const fs = require("fs");
const inspire = require("@valos/inspire");
const deepExtend = require("@valos/tools/deepExtend").default;

exports.command = "perspire [revelationPath]";
exports.describe = "headless server-side environment";

exports.disabled = (yargs) => !yargs.vlm.packageConfig;
exports.builder = (yargs) => yargs.options({});

exports.handler = (yargv) => {
  // Example template which displays the command name itself and package name where it is ran
  // Only enabled inside package
  const vlm = yargv.vlm;

  let revelationPath = yargv.revelationPath || "./valaa.json";
//  if (revelationPath.search("valaa.json") === -1) {
//    revelationPath += "valaa.json";
//  }
//  console.log("revelationPath", revelationPath);

  if (!vlm.shell.test("-f", revelationPath)) {
    vlm.info(`file not found ${revelationPath}`);
    process.exit();
  } else {
    const revelation = JSON.parse(fs.readFileSync(revelationPath));
    const perspire = inspire.default(revelation);
  }
};

/*
fs.readFile(revelationPath, (err, data) => {
  // perspire commands here!
  const dataJson = JSON.parse(data);
}
*/
