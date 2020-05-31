const { createConfigureToolsetOptions, configureToolSelection } = require("@valos/type-toolset");

exports.vlm = { toolset: "@valos/type-worker" };
exports.command = ".configure/.type/.worker/@valos/type-worker";
exports.brief = "configure 'type-worker'";
exports.describe = "Configure the 'type-worker' toolset";
exports.introduction = `
`;

exports.disabled = (yargs) => (yargs.vlm.getValOSConfig("type") !== "worker")
    && `Workspace is not a worker`;
exports.builder = (yargs) => {
  const toolsetConfig = yargs.vlm.getToolsetConfig(yargs.vlm.toolset) || {};
  return yargs.options({
    serviceURI: {
      type: "string", default: toolsetConfig.serviceURI || undefined,
      interactive: { type: "input", when: yargs.vlm.reconfigure ? "always" : "if-undefined" },
      description: "The service chronicle URI",
    },
    ...createConfigureToolsetOptions(yargs.vlm, exports),
  });
};

exports.handler = async (yargv) => {
  const vlm = yargv.vlm;
  const toolsetConfig = vlm.getToolsetConfig(vlm.toolset);
  if (!toolsetConfig) return undefined;

  const templates = vlm.path.join(__dirname, "../templates/{.,}*");
  vlm.info("Copying missing worker config files", " from templates at:",
      vlm.theme.path(templates), "(will not clobber existing files)");
  vlm.shell.cp("-nR", templates, ".");
  const toolsetConfigUpdate = { ...vlm.getToolsetConfig(vlm.toolset) };
  toolsetConfigUpdate.serviceURI = yargv.serviceURI;
  if (yargv.reconfigure || !(toolsetConfigUpdate.commands || {}).perspire) {
    toolsetConfigUpdate.commands = toolsetConfigUpdate.commands || {};
    toolsetConfigUpdate.commands.perspire = {
      options: {
        keepalive: 5,
        output: "dist/perspire/vdomSnapshot.html",
        spindles: [],
      }
    };
  }
  await vlm.updateToolsetConfig(vlm.toolset, toolsetConfigUpdate);

  const selectionResult = await configureToolSelection(
      vlm, vlm.toolset, yargv.reconfigure, yargv.tools);
  return { command: exports.command, ...selectionResult };
};
