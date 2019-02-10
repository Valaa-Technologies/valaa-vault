exports.command = ".configure/.domain/infrastructure";
exports.describe = "Configure the 'infrastructure' domain for this workspace";
exports.introduction = `${exports.describe}.`;

exports.disabled = (yargs) => (yargs.vlm.getPackageConfig("valaa", "domain") !== "infrastructure")
    && `Workspace domain is not 'infrastructure' (is '${
        yargs.vlm.getPackageConfig("valaa", "domain")}')`;
exports.builder = (yargs) => yargs.options({
  reconfigure: {
    alias: "r", type: "boolean",
    description: "Reconfigure all 'infrastructure' domain config of this workspace.",
  },
});

exports.handler = (yargv) =>
    yargv.vlm.invoke(`.configure/.domain/.infrastructure/**/*`, { reconfigure: yargv.reconfigure });
