const { createConfigureToolsetOptions, configureToolSelection } = require("@valos/type-toolset");

exports.vlm = { toolset: "@valos/web-spindle" };
exports.command = ".configure/.toolset/@valos/web-spindle";
exports.brief = "configure toolset";
exports.describe = "Configure the toolset 'web-spindle' within the current workspace";
exports.introduction = `${exports.describe}.

As a toolset this script is automatically called by configure.`;

exports.disabled = (yargs) => !yargs.vlm.getToolsetConfig(yargs.vlm.toolset, "inUse")
    && `Toolset '${yargs.vlm.toolset}' not in use`;
exports.builder = (yargs) => {
  const toolsetConfig = yargs.vlm.getToolsetConfig(exports.vlm.toolset) || {};
  return yargs.options({
    port: {
      type: "string", default: toolsetConfig.port || 80,
      interactive: { type: "input", when: yargs.vlm.reconfigure ? "always" : "if-undefined" },
      description: "The port the Web API listens.",
    },
    address: {
      type: "string", default: toolsetConfig.address || "0.0.0.0",
      interactive: { type: "input", when: yargs.vlm.reconfigure ? "always" : "if-undefined" },
      description: "The local address the Web API is bound to.",
    },
    ...createConfigureToolsetOptions(yargs.vlm, exports),
  });
};

exports.handler = async (yargv) => {
  const vlm = yargv.vlm;
  const toolsetConfigUpdate = { ...vlm.getToolsetConfig(vlm.toolset) };
  toolsetConfigUpdate.port = yargv.port;
  toolsetConfigUpdate.address = yargv.address;
  vlm.updateToolsetConfig(vlm.toolset, toolsetConfigUpdate);

  await require("@valos/type-worker")
      .updateSpindleAsWorkerTool(vlm, vlm.toolset, true);

  const selectionResult = await configureToolSelection(
      vlm, vlm.toolset, yargv.reconfigure, yargv.tools);
  return { success: true, ...selectionResult };
};
