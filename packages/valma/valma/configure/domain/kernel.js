exports.command = ".configure/.domain/kernel";
exports.describe = "Configure a Valaa repository to be part of the kernel domain";
exports.introduction = `${exports.describe}.`;

exports.builder = (yargs) => yargs.options({
  reconfigure: {
    alias: "r", type: "boolean",
    description: "Reconfigure all 'kernel' domain configurations of this repository.",
  },
});

exports.handler = (yargv) =>
    yargv.vlm.invoke(`.configure/.domain/.kernel/**/*`, { reconfigure: yargv.reconfigure });
