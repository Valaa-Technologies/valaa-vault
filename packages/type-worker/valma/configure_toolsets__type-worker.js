const typeToolset = require("@valos/type-toolset");

exports.vlm = { toolset: "@valos/type-worker" };
exports.command = ".configure/.toolsets/@valos/type-worker";
exports.brief = "configure 'type-worker'";
exports.describe = "Configure the 'type-worker' toolset";
exports.introduction = `
`;

exports.disabled = (yargs) => typeToolset.checkToolsetDisabled(yargs.vlm, exports);
exports.builder = (yargs) => {
  const toolsetConfig = yargs.vlm.getToolsetConfig(exports.vlm.toolset) || {};
  return yargs.options({
    serviceURI: {
      type: "string", default: toolsetConfig.serviceURI || undefined,
      interactive: answers => ({
        type: "input", when: answers.reconfigure ? "always" : "if-undefined",
      }),
      description: "The service chronicle URI",
    },
    ...typeToolset.createConfigureToolsetOptions(yargs.vlm, exports),
  });
};

exports.handler = async (yargv) => {
  const vlm = yargv.vlm;
  const toolsetConfig = vlm.getToolsetConfig(exports.vlm.toolset);
  if (!toolsetConfig) return undefined;

  const templates = vlm.path.join(__dirname, "../templates/{.,}*");
  vlm.info("Copying missing worker config files", " from templates at:",
      vlm.theme.path(templates), "(will not clobber existing files)");
  vlm.shell.cp("-nR", templates, ".");
  const toolsetConfigUpdate = {
    ...toolsetConfig,
    serviceURI: yargv.serviceURI,
  };
  if (yargv.reconfigure || !(toolsetConfigUpdate.commands || {}).perspire) {
    toolsetConfigUpdate.commands = toolsetConfigUpdate.commands || {};
    toolsetConfigUpdate.commands.perspire = {
      options: {
        keepalive: 60,
        heartbeat: "worker-perspire-template",
        output: "dist/perspire/worker-view.html",
        spindles: [],
      }
    };
  }
  await vlm.updateToolsetConfig(vlm.toolset, toolsetConfigUpdate);

  const selectionResult = await typeToolset.configureToolSelection(
      vlm, vlm.toolset, yargv.reconfigure, yargv.tools);
  return {
    command: exports.command,
    success: true,
    ...selectionResult,
  };
};
