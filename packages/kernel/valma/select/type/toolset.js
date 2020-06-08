exports.vlm = { toolset: "@valos/type-toolset" };
exports.command = ".select/.type/toolset";
exports.brief = "select type toolset";
exports.describe = "Construct a collection of valma tools that other workspaces can select and use";
exports.introduction =
`A toolset is a package that can be selected by any valos workspace
during 'vlm init'. More precisely:
1. given that the toolset is registered to a domain, and
2. the workspace is set up to use this domain (f.ex. during 'vlm init'), then
2. the 'vlm configure' presents the toolset as a selectable option, and if selected,
3. the toolset is added as a devDependency to the workspace, and also
4. a toolset configuration section with "inUse: true" is added to the
  workspace 'toolsets.json' using the toolset name as the key, and finally
5. the toolset configuration valma command is called by 'vlm configure'

This makes all valma commands and other primitives of the toolset
available for the workspace and also allows these commands to manage
their workspace-specific configurations.
`;

exports.disabled = () => false;
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
