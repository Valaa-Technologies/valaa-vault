exports.command = ".configure/.domain/packages";
exports.describe = "Configure a Valaa repository to be part of the packages utility domain";
exports.introduction = `${exports.describe}.

Packages utility domain provides tools for assembling and publishing
packages to npm repositories.`;

exports.builder = (yargs) => yargs.options({
  reconfigure: {
    alias: "r", type: "boolean",
    description: "Reconfigure all 'packages' domain configurations of this repository.",
  },
});

exports.handler = (yargv) =>
    yargv.vlm.invoke(`.configure/.domain/.packages/**/*`, { reconfigure: yargv.reconfigure });
