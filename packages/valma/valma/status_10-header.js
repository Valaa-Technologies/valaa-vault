#!/usr/bin/env vlm

exports.command = ".status/10-header";
exports.describe = "Display the generic information header for current workspace";
exports.introduction = `${exports.describe}.`;

exports.disabled = (yargs) => !yargs.vlm.getPackageConfig("valos", "type")
    && !yargs.vlm.getValOSConfig("type")
    && `No package.json valos.type stanza found`;
exports.builder = (yargs) => yargs;

exports.handler = (yargv) => {
  const vlm = yargv.vlm;
  const config = yargv.vlm.getPackageConfig();
  const valos = config && (config.valos || config.valaa);
  if (!valos || !valos.type || (valos.domain == null)) {
    vlm.warn(
`package '${yargv.vlm.theme.package(config && config.name)}' is not a
valos workspace. Either package.json doesn't have the .valos stanza or
its .domain or .type is not set.
Call '${yargv.vlm.theme.command("vlm init")}' to initialize.
`);
    return undefined;
  }
  return {
    "": { entries: [{ header: {
      heading: {
        style: "bold",
        text: `${valos.domain} ${valos.type} ${vlm.theme.package(config.name)}@${
            vlm.theme.version(config.version)}` }
    } }] },
    header: [],
  };
};
