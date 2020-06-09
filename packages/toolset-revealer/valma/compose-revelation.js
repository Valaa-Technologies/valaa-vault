#!/usr/bin/env vlm

exports.vlm = { toolset: "@valos/toolset-revealer" };
exports.command = "compose-revelation";
exports.describe = "Compose revealer bundles based on the revealer toolset config";
exports.introduction = ``;

// Example template which displays the command name itself and package name where it is ran
// Only enabled inside package
exports.disabled = (yargs) => !yargs.vlm.getPackageConfig() && "No package.json found";
exports.builder = (yargs) => yargs;

exports.handler = (yargv) => {
  const vlm = yargv.vlm;
  return vlm && true;
};
