exports.vlm = { toolset: "@valos/rest-api-spindle" };
exports.command = ".configure/.@valos/type-worker/.tools/.select/@valos/rest-api-spindle";
exports.brief = "select 'rest-api-spindle'";
exports.describe = "Select the worker toolset 'rest-api-spindle'";
exports.introduction =
`This spindle extends a perspire worker workspace with REST-style
configurable and extensible web service.`;

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
  // @valos/rest-api-spindle actual.
  // See type/toolsets.js for how new select/configure scripts are created.
  const vlm = yargv.vlm;

  const toolsetConfigUpdate = { ...vlm.getToolsetConfig(vlm.toolset) };
  toolsetConfigUpdate.port = yargv.port;
  toolsetConfigUpdate.address = yargv.address;
  vlm.updateToolsetConfig(vlm.toolset, toolsetConfigUpdate);

  // Add/remove the rest API spindle to type-worker config
  const workerToolsetSpindles = vlm.getToolsetConfig("@valos/type-worker",
      "commands", "perspire", "options", "spindle-id") || [];
  if (toolsetConfigUpdate.inUse && !workerToolsetSpindles.includes(vlm.toolset)) {
    vlm.updateToolsetConfig("@valos/type-worker",
        { commands: { perspire: { options: { "spindle-id": [vlm.toolset] } } } });
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
      "@valos/rest-api-spindle": vlm.domainVersionTag("@valos/kernel"),
    },
    ...selectionResult,
  };
};
