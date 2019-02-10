exports.command = ".configure/.domain/gateway";
exports.describe = "Configure the 'gateway' domain for this workspace";
exports.introduction = `${exports.describe}.`;

exports.disabled = (yargs) => (yargs.vlm.getPackageConfig("valaa", "domain") !== "gateway")
    && `Workspace domain is not 'gateway' (is '${yargs.vlm.getPackageConfig("valaa", "domain")}')`;
exports.builder = (yargs) => yargs.options({
  reconfigure: {
    alias: "r", type: "boolean",
    description: "Reconfigure all 'gateway' domain config of this workspace.",
  },
});

exports.handler = (yargv) =>
    yargv.vlm.invoke(`.configure/.domain/.gateway/**/*`, { reconfigure: yargv.reconfigure });
