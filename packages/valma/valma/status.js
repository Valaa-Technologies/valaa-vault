#!/usr/bin/env vlm
exports.command = "status [toolsetGlob]";
exports.describe = "Display the status of the current package repository";
exports.introduction = `${exports.describe}.

If toolsetGlob is specified the status is limited to status scripts
matching '.status/{toolsetGlob}*', otherwise all status scripts by
'.status/**/*' are used.`;

exports.disabled = (yargs) => !yargs.vlm.packageConfig && "No package.json found";
exports.status = (/* yargs */) => "Status ok!";
exports.builder = (yargs) => yargs.options({
  echos: {
    type: "boolean", default: false,
    describe: "Status disables the echos by default",
  },
});

exports.handler = async (yargv) => {
  const vlm = yargv.echos ? yargv.vlm
      : Object.assign(Object.create(yargv.vlm), { echo: function noEcho () { return this; } });
  if (!vlm.packageConfig) {
    vlm.error("Current directory is not a package repository;", vlm.theme.path("package.json"),
        "doesn't exist or is not valid.");
    return false;
  }
  const valaa = vlm.packageConfig.valaa;
  const statusCommandInvokations = [{},
    vlm.invoke(`.status/${yargv.toolsetGlob || "**/"}*`, yargv._),
    !(valaa && valaa.type) ? [] :
        vlm.invoke(`.status/.type/.${valaa.type}/${yargv.toolsetGlob || "**/"}*`, yargv._),
    !(valaa && valaa.domain) ? [] :
        vlm.invoke(`.status/.domain/.${valaa.domain}/${yargv.toolsetGlob || "**/"}*`, yargv._),
  ];
  const resolveds = [].concat(...await Promise.all(statusCommandInvokations))
      .filter(e => e && (typeof e === "object"));
  const deepExtend = require("@valos/tools/deepExtend").default;

  return resolveds.reduce((acc, res) => deepExtend(acc, res), { "": { chapters: true } });
};
