const typeToolset = require("@valos/type-toolset");

exports.vlm = { toolset: "@valos/type-library" };
exports.command = ".configure/.toolsets/@valos/type-library";
exports.brief = "configure library type toolset";
exports.describe = "Configure the toolset '@valos/type-library' within the current workspace";
exports.introduction = `${exports.describe}.

As a toolset this script is automatically called by configure.`;

exports.disabled = (yargs) => typeToolset.checkToolsetDisabled(yargs.vlm, exports);
exports.builder = (yargs) => yargs.options({
  ...typeToolset.createConfigureToolsetOptions(yargs.vlm, exports),
});

exports.handler = async (yargv) => {
  const vlm = yargv.vlm;
  const toolsetConfig = vlm.getToolsetConfig(exports.vlm.toolset) || {};
  const toolsetConfigUpdate = { ...toolsetConfig };
  // Construct a toolset config update or exit.
  vlm.updateToolsetConfig(vlm.toolset, toolsetConfigUpdate);
  const selectionResult = await typeToolset.configureToolSelection(
      vlm, vlm.toolset, yargv.reconfigure, yargv.tools);
  return { success: true, ...selectionResult };
};
