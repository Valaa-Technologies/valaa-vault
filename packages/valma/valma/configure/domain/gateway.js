exports.command = ".configure/.domain/gateway";
exports.describe = "Configure a valaa repository to be part of the gateway domain";
exports.introduction = `${exports.describe}.`;

exports.builder = (yargs) => yargs.options({
  reconfigure: {
    alias: "r", type: "boolean",
    description: "Reconfigure all 'gateway' domain configurations of this repository.",
  },
});

exports.handler = (yargv) =>
    yargv.vlm.invoke(`.configure/.domain/.gateway/**/*`, { reconfigure: yargv.reconfigure });
