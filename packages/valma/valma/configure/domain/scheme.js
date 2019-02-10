exports.command = ".configure/.domain/scheme";
exports.describe = "Configure the 'scheme' domain for this workspace";
exports.introduction = `${exports.describe}.`;

exports.disabled = (yargs) => (yargs.vlm.getPackageConfig("valaa", "domain") !== "scheme")
    && `Workspace domain is not 'scheme' (is '${yargs.vlm.getPackageConfig("valaa", "domain")}')`;
exports.builder = (yargs) => yargs.options({
  reconfigure: {
    alias: "r", type: "boolean",
    description: "Reconfigure all 'scheme' domain config of this workspace.",
  },
});

exports.handler = (yargv) =>
    yargv.vlm.invoke(`.configure/.domain/.scheme/**/*`, { reconfigure: yargv.reconfigure });
