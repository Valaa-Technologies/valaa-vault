exports.command = ".configure/.domain/packages";
exports.describe = "Configure the 'packages' domain for this workspace";
exports.introduction = `${exports.describe}.

Packages utility domain provides tools for assembling and publishing
packages to npm repositories.`;

exports.disabled = (yargs) => (yargs.vlm.getValOSConfig("domain") !== "packages")
    && `Workspace domain is not 'packages' (is '${yargs.vlm.getValOSConfig("domain")}')`;
exports.builder = (yargs) => yargs.options({
  reconfigure: {
    alias: "r", type: "boolean",
    description: "Reconfigure all 'packages' domain config of this workspace.",
  },
});

exports.handler = (yargv) =>
    yargv.vlm.invoke(`.configure/.domain/.packages/**/*`, { reconfigure: yargv.reconfigure });
