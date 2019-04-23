exports.command = ".configure/.type/library";
exports.describe = "Configure a 'library' workspace";
exports.introduction = `${exports.describe}.

Libraries are workspaces which contain arbitrary ES5 source code and
expose an API via package.json .main stanza (usually index.js).

Libraries are intended to be published as packages.

A typical valos library workspace resides in a packages/* workspace
directory of some vault.

While a library can provide convenience valma commands it is not
a toolset. This means that another workspace which dev-depends on
a library package (directly or indirectly) won't have a valma toolset
config for it; this in turn means that its valma commands cannot use
vlm.getTool(set)Config and are essentially 'stateless'.`;

exports.disabled = (yargs) => (yargs.vlm.getValOSConfig("type") !== "library")
    && `Workspace is not a 'library' (is '${yargs.vlm.getValOSConfig("type")}')`;
exports.builder = (yargs) => yargs.options({
  reconfigure: {
    alias: "r", type: "boolean",
    description: "Reconfigure all 'library' type config of this workspace.",
  },
});

exports.handler = (yargv) =>
    yargv.vlm.invoke(`.configure/.type/.library/**/*`, { reconfigure: yargv.reconfigure });
