exports.vlm = { toolset: "@valos/toolset-rest-api-gateway-plugin" };
exports.command = ".configure/.type/.worker/.select/@valos/toolset-rest-api-gateway-plugin";
exports.describe = "Select the toolset 'toolset-rest-api-gateway-plugin'";
exports.introduction = `${exports.describe}.

`;

exports.disabled = (yargs) => (yargs.vlm.getValOSConfig("type") !== "worker")
    && `Workspace is not a worker (is ${yargs.vlm.getValOSConfig("type")})`;
exports.builder = (yargs) => {
  const toolsetConfig = yargs.vlm.getToolsetConfig(yargs.vlm.toolset) || {};
  return yargs.options({
    ...yargs.vlm.createConfigureToolsetOptions(exports),
    port: {
      type: "string", default: toolsetConfig.port || undefined,
      interactive: { type: "input", when: yargs.vlm.reconfigure ? "always" : "if-undefined" },
      description: "The port the REST API listens.",
    },
    address: {
      type: "string", default: toolsetConfig.address || "",
      interactive: { type: "input", when: yargs.vlm.reconfigure ? "always" : "if-undefined" },
      description: "The local address the REST API is bound to.",
    },
  });
};

exports.handler = async (yargv) => {
  // This script is outdated: it combines select and configure script.
  // The configure script should be extracted and moved under
  // @valos/toolset-rest-api-gateway-plugin actual.
  // See type/toolsets.js for how new select/configure scripts are created.
  const vlm = yargv.vlm;

  const toolsetConfigUpdate = { ...vlm.getToolsetConfig(vlm.toolset) };
  toolsetConfigUpdate.port = yargv.port;
  toolsetConfigUpdate.address = yargv.address;
  vlm.updateToolsetConfig(vlm.toolset, toolsetConfigUpdate);

  // Add/remove the rest API plugin to type-worker config
  const workerToolsetPlugins = vlm.getToolsetConfig("@valos/type-worker",
      "commands", "perspire", "options", "plugin") || [];
  if (toolsetConfigUpdate.inUse && !workerToolsetPlugins.includes(vlm.toolset)) {
    vlm.updateToolsetConfig("@valos/type-worker",
        { commands: { perspire: { options: { plugin: [vlm.toolset] } } } });
  } else if (!toolsetConfigUpdate.inUse && (workerToolsetPlugins.includes(vlm.toolset))) {
    vlm.warn(`Removing stowed toolset '${vlm.toolset
        }' from '@valos/type-worker' config plugins not implemented yet.`,
        "Please remove the plugin manually");
    // TODO(iridian, 2019-02): Removing values using the updateToolsetConfig is not implemented yet.
  }
  const selectionResult = await vlm.configureToolSelection(
      yargv, vlm.getToolsetConfig(vlm.toolset));
  return {
    command: exports.command,
    devDependencies: { "@valos/toolset-rest-api-gateway-plugin": true },
    ...selectionResult,
  };
};
