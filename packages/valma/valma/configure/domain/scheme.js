exports.command = ".configure/.domain/scheme";
exports.describe = "Configure a Valaa repository to be part of the scheme domain";
exports.introduction = `${exports.describe}.`;

exports.builder = (yargs) => yargs.options({
  reconfigure: {
    alias: "r", type: "boolean",
    description: "Reconfigure all 'scheme' domain configurations of this repository.",
  },
});

exports.handler = (yargv) =>
    yargv.vlm.invoke(`.configure/.domain/.scheme/**/*`, { reconfigure: yargv.reconfigure });
