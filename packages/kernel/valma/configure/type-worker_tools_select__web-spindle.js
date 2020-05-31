const { createConfigureToolsetOptions } = require("@valos/type-toolset");

exports.vlm = { toolset: "@valos/web-spindle" };
exports.command = ".configure/.@valos/type-worker/.tools/.select/@valos/web-spindle";
exports.brief = "select web-spindle";
exports.describe = "Select web-spindle as worker tool";
exports.introduction =
`Selects web-spindle as a worker tool.`;

exports.disabled = (yargs) => (yargs.vlm.getValOSConfig("type") !== "worker")
    && `Workspace is not a worker`;
exports.builder = (yargs) => {
  const toolsetConfig = yargs.vlm.getToolsetConfig(exports.vlm.toolset) || {};
  return yargs.options({
    ...createConfigureToolsetOptions(yargs.vlm, exports),
    port: {
      type: "string", default: toolsetConfig.port || undefined,
      interactive: { type: "input", when: yargs.vlm.reconfigure ? "always" : "if-undefined" },
      description: "The port the Web API listens.",
    },
    address: {
      type: "string", default: toolsetConfig.address || "",
      interactive: { type: "input", when: yargs.vlm.reconfigure ? "always" : "if-undefined" },
      description: "The local address the Web API is bound to.",
    },
  });
};

exports.handler = async (yargv) => {
  // This script is outdated: it combines select and configure script.
  // The configure script should be extracted and moved under
  // @valos/web-spindle actual.
  // See type/toolsets.js for how new select/configure scripts are created.
  const vlm = yargv.vlm;

  const toolsetConfigUpdate = { ...vlm.getToolsetConfig(vlm.toolset) };
  toolsetConfigUpdate.port = yargv.port;
  toolsetConfigUpdate.address = yargv.address;
  vlm.updateToolsetConfig(vlm.toolset, toolsetConfigUpdate);

  // Add/remove the web API spindle to type-worker config
  const workerToolsetSpindles = vlm.getToolsetConfig(
      "@valos/type-worker", "commands", "perspire", "options", "spindles") || [];
  if (toolsetConfigUpdate.inUse && !workerToolsetSpindles.includes(vlm.toolset)) {
    vlm.updateToolsetConfig("@valos/type-worker",
        { commands: { perspire: { options: { spindles: [vlm.toolset] } } } });
  } else if (!toolsetConfigUpdate.inUse && (workerToolsetSpindles.includes(vlm.toolset))) {
    vlm.warn(`Removing stowed toolset '${vlm.toolset
        }' from '@valos/type-worker' config spindles not implemented yet.`,
        "Please remove the spindle manually");
    // TODO(iridian, 2019-02): Removing values using the updateToolsetConfig is not implemented yet.
  }
  const selectionResult = await vlm.configureToolSelection(
      yargv, vlm.getToolsetConfig(vlm.toolset));
  return {
    command: exports.command,
    devDependencies: {
      "@valos/web-spindle": vlm.domainVersionTag("@valos/kernel"),
    },
    ...selectionResult,
  };
};
