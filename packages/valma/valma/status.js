#!/usr/bin/env vlm
exports.command = "status [toolsetGlob]";
exports.describe = "Display the status of the current workspace";
exports.introduction = `${exports.describe}.

If toolsetGlob is specified the status is limited to status scripts
matching '.status/*{toolsetGlob}*/**/*', otherwise all status scripts by
'.status/**/*' are used.`;

exports.disabled = (yargs) => !yargs.vlm.packageConfig && "No package.json found";
exports.status = (/* yargs */) => "Status ok!";
exports.builder = (yargs) => yargs.options({
  echos: {
    type: "boolean", default: false,
    describe: "Echo sub-command invokations to log",
  },
});

exports.handler = async (yargv) => {
  const vlm = yargv.echos ? yargv.vlm
      : Object.assign(Object.create(yargv.vlm), { echo: function noEcho () { return this; } });
  if (!vlm.packageConfig) {
    vlm.error("Current directory is not a workspace;", vlm.theme.path("package.json"),
        "doesn't exist or is not valid.");
    return false;
  }
  const valos = vlm.packageConfig.valos || vlm.packageConfig.valaa;
  const subCommandGlob = yargv.toolsetGlob ? `*${yargv.toolsetGlob}*/**/*` : "**/*";
  const pendingSubCommandInvokations = [
    vlm.invoke(`.status/${subCommandGlob}`, yargv._),
    !(valos && valos.type) ? [] :
        vlm.invoke(`.status/.type/.${valos.type}/${subCommandGlob}`, yargv._),
    !(valos && valos.domain) ? [] :
        vlm.invoke(`.status/.domain/.${valos.domain}/${subCommandGlob}`, yargv._),
  ];
  const resolveds = [].concat(...await Promise.all(pendingSubCommandInvokations))
      .filter(e => e && (typeof e === "object"));
  const patchWith = require("@valos/tools/patchWith").default;

  return resolveds.reduce((acc, res) => patchWith(acc, res), { "": { chapters: true } });
};
