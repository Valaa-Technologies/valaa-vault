exports.command = ".configure/.type/library";
exports.describe = "Configure a Valaa library repository";
exports.introduction = `${exports.describe}.

Libraries are repositories which contain arbitrary ES5 source code and
expose an API via package.json .main stanza.

While a library can provide valma commands it is not a toolset. Thus it
can't have repository specific configurations or release builds.
Create or configure a toolset for building releases from libraries.`;

exports.builder = (yargs) => yargs.options({
  reconfigure: {
    alias: "r", type: "boolean",
    description: "Reconfigure all 'library' type configurations of this repository.",
  },
});

exports.handler = (yargv) =>
    yargv.vlm.invoke(`.configure/.type/.library/**/*`, { reconfigure: yargv.reconfigure });
