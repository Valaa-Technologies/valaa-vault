exports.command = ".configure/.type/library";
exports.describe = "Select 'library' workspace type";
exports.introduction =
`A library workspace contains arbitrary ES5 source code and exposes a
API via package.json .main stanza (usually index.js).

A library can provide convenience valma commands but unlike toolsets
a library cannot have workspace local configurations.

Library workspaces are almost always published as a packages and
typically reside in "packages/*" vault workspace directory.`;

exports.disabled = (yargs) => (yargs.vlm.getValOSConfig("type") !== "library")
    && `Workspace is not a library`;
exports.builder = (yargs) => yargs.options({
  reconfigure: {
    alias: "r", type: "boolean",
    description: "Reconfigure all 'library' configurations of this workspace.",
  },
});

exports.handler = () => ({ success: true });
