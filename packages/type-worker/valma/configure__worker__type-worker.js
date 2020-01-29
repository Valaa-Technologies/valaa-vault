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
    ...yargs.vlm.createConfigureToolsetOptions(exports),
    rootPartitionURI: {
      type: "string", default: toolsetConfig.rootPartitionURI || undefined,
      interactive: { type: "input", when: yargs.vlm.reconfigure ? "always" : "if-undefined" },
      description: "The partition URI perspire gateway loads and renders first",
    },
    spindles: {
      type: "string", array: true,
      default: (((toolsetConfig.commands || {}).perspire || {}).options || {}).spindles || [],
      description: "List of spindle id's which are require'd before gateway creation.",
    },
  });
};

exports.handler = async (yargv) => {
  const vlm = yargv.vlm;
  const toolsetConfig = vlm.getToolsetConfig(vlm.toolset);
  if (!toolsetConfig) return undefined;

  const templates = vlm.path.join(__dirname, "../templates/{.,}*");
  vlm.info("Copying missing worker config files", " from templates at:",
      vlm.theme.path(templates), "(will not clobber existing files)");
  vlm.shell.cp("-n", templates, ".");
  const toolsetConfigUpdate = { ...vlm.getToolsetConfig(vlm.toolset) };
  toolsetConfigUpdate.rootPartitionURI = yargv.rootPartitionURI;
  if (yargv.reconfigure || !(toolsetConfigUpdate.commands || {}).perspire) {
    toolsetConfigUpdate.commands = toolsetConfigUpdate.commands || {};
    toolsetConfigUpdate.commands.perspire = {
      options: {
        keepalive: 5,
        output: "dist/perspire/vdomSnapshot.html",
        spindles: yargv.spindles,
      }
    };
  }
  await vlm.updateToolsetConfig(vlm.toolset, toolsetConfigUpdate);

  const selectionResult = await vlm.configureToolSelection(yargv, toolsetConfig);
  return { command: exports.command, ...selectionResult };
};
