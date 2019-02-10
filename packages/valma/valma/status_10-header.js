#!/usr/bin/env vlm

exports.command = ".status/10-header";
exports.describe = "Display the generic information header for current workspace";
exports.introduction = `${exports.describe}.`;

exports.disabled = (yargs) => !yargs.vlm.getPackageConfig("valaa", "type")
    && `No package.json valaa.type stanza found`;
exports.builder = (yargs) => yargs;

exports.handler = (yargv) => {
  const vlm = yargv.vlm;
  const config = yargv.vlm.packageConfig;
  const valaa = config && config.valaa;
  if (!valaa || !valaa.type || !valaa.domain) {
    vlm.warn(
`package '${yargv.vlm.theme.package(config && config.name)}' is not a
valaa repository. Either package.json doesn't have the .valaa stanza or
its .domain or .type is not set.
Call '${yargv.vlm.theme.command("vlm init")}' to initialize.
`);
    return undefined;
  }
  return {
    "": { entries: [{ header: {
      heading: {
        style: "bold",
        text: `${valaa.domain} ${valaa.type} ${vlm.theme.package(config.name)}@${
            vlm.theme.version(config.version)}` }
    } }] },
    header: [],
  };
};
