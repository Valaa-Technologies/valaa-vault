exports.vlm = { toolset: "@valos/toolset-domain" };
exports.command = ".configure/.toolset/@valos/toolset-domain";
exports.brief = "configure toolset";
exports.describe = "Configure the toolset 'toolset-domain' within the current workspace";
exports.introduction = `${exports.describe}.

As a toolset this script is automatically called by configure.`;

exports.disabled = (yargs) => !yargs.vlm.getToolsetConfig(yargs.vlm.toolset, "inUse")
    && `Toolset '${yargs.vlm.toolset}' not in use`;
exports.builder = (yargs) => yargs.options({
  ...yargs.vlm.createConfigureToolsetOptions(exports),
});

exports.handler = async (yargv) => {
  const vlm = yargv.vlm;
  const toolsetConfig = vlm.getToolsetConfig(vlm.toolset) || {};
  const toolsetConfigUpdate = {}; // Construct a toolset config update or bail out.
  vlm.updateToolsetConfig(vlm.toolset, toolsetConfigUpdate);
  const selectionResult = await vlm.configureToolSelection(yargv, toolsetConfig);
  return { success: true, ...selectionResult };
};
