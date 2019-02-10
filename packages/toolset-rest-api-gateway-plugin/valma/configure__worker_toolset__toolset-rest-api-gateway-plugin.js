exports.vlm = { toolset: "@valos/toolset-rest-api-gateway-plugin" };
exports.command = ".configure/.type/.worker/.toolset/@valos/toolset-rest-api-gateway-plugin";
exports.describe = "Configure an in-use 'toolset-rest-api-gateway-plugin' for a worker workspace";
exports.introduction = `${exports.describe}.

This script makes the toolset 'toolset-rest-api-gateway-plugin' available for
grabbing by repositories with valaa type 'worker'.`;

exports.disabled = (yargs) => !yargs.vlm.getToolsetConfig(yargs.vlm.toolset, "inUse")
    && "Can't configure 'toolset-rest-api-gateway-plugin': not inUse or toolset config missing";
exports.builder = (yargs) => {
  const toolsetConfig = yargs.vlm.getToolsetConfig(yargs.vlm.toolset) || {};
  yargs.options({
    reconfigure: {
      alias: "r", type: "boolean",
      description: "Reconfigure 'toolset-rest-api-gateway-plugin' config of this workspace.",
    },
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

exports.handler = (yargv) => {
  const vlm = yargv.vlm;

  const toolsetConfigUpdate = { ...vlm.getToolsetConfig(vlm.toolset) };
  toolsetConfigUpdate.port = yargv.port;
  toolsetConfigUpdate.address = yargv.address;
  vlm.updateToolsetConfig(vlm.toolset, toolsetConfigUpdate);

  // Add/remove the rest API plugin to toolset-worker config
  const workerToolsetPlugins = vlm.getToolsetConfig("@valos/toolset-worker",
      "commands", "perspire", "options", "plugin") || [];
  if (toolsetConfigUpdate.inUse && !workerToolsetPlugins.includes(vlm.toolset)) {
    vlm.updateToolsetConfig("@valos/toolset-worker",
        { commands: { perspire: { options: { plugin: [vlm.toolset] } } } });
  } else if (!toolsetConfigUpdate.inUse && (workerToolsetPlugins.includes(vlm.toolset))) {
    vlm.warn(`Removing stowed toolset '${vlm.toolset
        }' from '@valos/toolset-worker' config plugins not implemented yet.`,
        "Please remove the plugin manually");
    // TODO(iridian, 2019-02): Removing values using the updateToolsetConfig is not implemented yet.
  }
};
