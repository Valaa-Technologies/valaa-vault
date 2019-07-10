exports.command = ".configure/.domain/@valos/kernel";
exports.describe = "Configure the @valos/kernel domain for this workspace";
exports.introduction = `${exports.describe}.`;

exports.disabled = (yargs) => (yargs.vlm.getValOSConfig("domain") !== "@valos/kernel")
    && `Workspace domain is not '@valos/kernel' (is '${yargs.vlm.getValOSConfig("domain")}')`;
exports.builder = (yargs) => yargs.options({
  reconfigure: {
    alias: "r", type: "boolean",
    description: "Reconfigure all '@valos/kernel' domain config of this workspace.",
  },
});

exports.handler = (yargv) =>
    yargv.vlm.invoke(`.configure/.domain/.@valos/kernel/**/*`, { reconfigure: yargv.reconfigure });
