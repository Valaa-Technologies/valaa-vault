const typeToolset = require("@valos/type-toolset");

exports.vlm = { toolset: "@valos/authority-spindle" };
exports.command = ".configure/.toolsets/.type/worker/@valos/authority-spindle";
exports.brief = "configure toolset";
exports.describe = "Configure the toolset '@valos/authority-spindle' within the current workspace";
exports.introduction = `${exports.describe}.`;

exports.disabled = (yargs) => typeToolset.checkToolsetDisabled(yargs.vlm, exports);
exports.builder = (yargs) => yargs.options({
  ...typeToolset.createConfigureToolsetOptions(yargs.vlm, exports),
});

exports.handler = async (yargv) => {
  // This code is called by 'vlm configure' every time it is executed
  // in a workspace that uses this toolset.
  // All packages specified as dev/dependencies by the toolset select
  // command are available.
  const vlm = yargv.vlm;
  const toolsetConfig = vlm.getToolsetConfig(exports.vlm.toolset) || {};
  const toolsetConfigUpdate = { ...toolsetConfig };
  // Construct a toolset config update or exit.
  vlm.updateToolsetConfig(vlm.toolset, toolsetConfigUpdate);
  const selectionResult = await typeToolset.configureToolSelection(
      vlm, vlm.toolset, yargv.reconfigure, yargv.tools);
  return { success: true, ...selectionResult };
};
