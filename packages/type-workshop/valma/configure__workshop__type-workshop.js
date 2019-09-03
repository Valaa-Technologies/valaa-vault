exports.vlm = { toolset: "@valos/type-workshop" };
exports.command = ".configure/.type/.workshop/@valos/type-workshop";
exports.brief = "configure 'type-workshop'";
exports.describe = "Configure the 'type-workshop' toolset";
exports.introduction = `
`;

exports.disabled = (yargs) => (yargs.vlm.getValOSConfig("type") !== "workshop")
    && `Workspace is not a workshop (is ${yargs.vlm.getValOSConfig("type")})`;
exports.builder = (yargs) => yargs.options({
  ...yargs.vlm.createConfigureToolsetOptions(exports),
});

exports.handler = async (yargv) => {
  const vlm = yargv.vlm;
  const toolsetConfig = vlm.getToolsetConfig(vlm.toolset);
  if (!toolsetConfig) return undefined;

  const templates = vlm.path.join(__dirname, "../templates/{.,}*");
  vlm.info("Copying missing workshop config files", " from templates at:",
      vlm.theme.path(templates), "(will not clobber existing files)");
  vlm.shell.cp("-n", templates, ".");

  const toolsetConfigUpdate = {}; // Construct a toolset config update or bail out.
  vlm.updateToolsetConfig(vlm.toolset, toolsetConfigUpdate);
  const selectionResult = await vlm.configureToolSelection(yargv, toolsetConfig);
  return { success: true, command: exports.command, ...selectionResult };
};
