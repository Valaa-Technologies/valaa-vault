exports.command = ".configure/.domain/infrastructure";
exports.describe = "Configure a Valaa repository to be part of the infrastructure domain";
exports.introduction = `${exports.describe}.`;

exports.builder = (yargs) => yargs.options({
  reconfigure: {
    alias: "r", type: "boolean",
    description: "Reconfigure all 'infrastructure' domain configurations of this repository.",
  },
});

exports.handler = (yargv) =>
    yargv.vlm.invoke(`.configure/.domain/.infrastructure/**/*`, { reconfigure: yargv.reconfigure });
