const { createConfigureToolsetOptions, configureToolSelection } = require("@valos/type-toolset");

exports.vlm = { toolset: "@valos/type-domain" };
exports.command = ".configure/.type/.domain/@valos/type-domain";
exports.brief = "configure 'type-domain'";
exports.describe = "Configure the 'type-domain' toolset";
exports.introduction = `
`;

exports.disabled = (yargs) => (yargs.vlm.getValOSConfig("type") !== "domain")
    && `Workspace is not a domain`;
exports.builder = (yargs) => yargs.options({
  ...createConfigureToolsetOptions(yargs.vlm, exports),
});

exports.handler = async (yargv) => {
  const vlm = yargv.vlm;
  const toolsetConfig = vlm.getToolsetConfig(vlm.toolset);
  if (!toolsetConfig) return undefined;

  const templates = vlm.path.join(__dirname, "../templates/{.,}*");
  vlm.info("Copying missing domain config files", " from templates at:",
      vlm.theme.path(templates), "(will not clobber existing files)");
  vlm.shell.cp("-n", templates, ".");

  const toolsetConfigUpdate = {}; // Construct a toolset config update or bail out.
  vlm.updateToolsetConfig(vlm.toolset, toolsetConfigUpdate);
  const selectionResult = await configureToolSelection(
      vlm, vlm.toolset, yargv.reconfigure, yargv.tools);
  return { success: true, command: exports.command, ...selectionResult };
};
