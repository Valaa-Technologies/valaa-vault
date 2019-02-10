exports.command = ".configure/.domain/kernel";
exports.describe = "Configure the 'kernel' domain for this workspace";
exports.introduction = `${exports.describe}.`;

exports.disabled = (yargs) => (yargs.vlm.getPackageConfig("valaa", "domain") !== "kernel")
    && `Workspace domain is not 'kernel' (is '${yargs.vlm.getPackageConfig("valaa", "domain")}')`;
exports.builder = (yargs) => yargs.options({
  reconfigure: {
    alias: "r", type: "boolean",
    description: "Reconfigure all 'kernel' domain config of this workspace.",
  },
});

exports.handler = (yargv) =>
    yargv.vlm.invoke(`.configure/.domain/.kernel/**/*`, { reconfigure: yargv.reconfigure });
