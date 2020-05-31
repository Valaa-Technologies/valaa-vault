exports.vlm = { toolset: "@valos/type-toolset" };
exports.command = ".configure/.type/toolset";
exports.brief = "select type toolset";
exports.describe = "Select 'toolset' valos workspace type";
exports.introduction =
`A toolset is a package that can be selected by any valos workspace, so that
1. the toolset is then added as a devDependency to the workspace, and
2. a toolset configuration section is added to the workspace 'toolsets.json'
  using the toolset name as the key.

This makes all valma commands and other primitives of the toolset
available for the workspace and also allows these commands to manage
their workspace-specific configurations.
`;

exports.disabled = (yargs) => (yargs.vlm.getValOSConfig("type") !== "toolset")
    && `Workspace is not a toolset`;
exports.builder = (yargs) => yargs.options({
  reconfigure: {
    alias: "r", type: "boolean",
    description: "Reconfigure all 'toolset' configurations of this workspace.",
  },
});

exports.handler = async (yargv) => ({
  devDependencies: { "@valos/type-toolset": yargv.vlm.domainVersionTag("@valos/kernel") },
  toolsetsUpdate: { "@valos/type-toolset": { inUse: "always" } },
  success: true,
});
