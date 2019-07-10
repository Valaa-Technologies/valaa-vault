exports.vlm = { toolset: "@valos/toolset-worker" };
exports.command = ".configure/.type/.worker/@valos/toolset-worker";
exports.describe = "Configure 'toolset-worker' for a worker repository";
exports.introduction = `${exports.describe}.

`;

exports.disabled = (yargs) => (yargs.vlm.getValOSConfig("type") !== "worker")
    && `Workspace is not a worker (is ${yargs.vlm.getValOSConfig("type")})`;
exports.builder = (yargs) => {
  const toolsetConfig = yargs.vlm.getToolsetConfig(yargs.vlm.toolset) || {};
  return yargs.options({
    reconfigure: {
      alias: "r", type: "boolean",
      description: "Reconfigure 'toolset-worker' config of this workspace.",
    },
    rootPartitionURI: {
      type: "string", default: toolsetConfig.rootPartitionURI || undefined,
      interactive: { type: "input", when: yargs.vlm.reconfigure ? "always" : "if-undefined" },
      description: "The partition URI perspire gateway loads and renders first",
    },
    plugin: {
      type: "string", array: true,
      default: (((toolsetConfig.commands || {}).perspire || {}).options || {}).plugin || [],
      description: "List of plugin id's which are require'd before gateway creation.",
    },
  });
};

exports.handler = async (yargv) => {
  const vlm = yargv.vlm;
  const templates = vlm.path.join(__dirname, "../templates/{.,}*");
  vlm.info("Copying missing worker config files", " from templates at:",
      vlm.theme.path(templates), "(will not clobber existing files)");
  vlm.shell.cp("-n", templates, ".");
  const devDependencies = { "@valos/toolset-worker": true };

  if (!vlm.getPackageConfig("devDependencies", "@valos/inspire")) {
    if (await vlm.inquireConfirm(`Install @valos/inspire in devDependencies?`)) {
      devDependencies["@valos/inspire"] = true;
    }
  }

  const toolsetConfigUpdate = { ...vlm.getToolsetConfig(vlm.toolset) };
  toolsetConfigUpdate.rootPartitionURI = yargv.rootPartitionURI;
  if (yargv.reconfigure || !(toolsetConfigUpdate.commands || {}).perspire) {
    toolsetConfigUpdate.commands = toolsetConfigUpdate.commands || {};
    toolsetConfigUpdate.commands.perspire = {
      options: {
        keepalive: 5,
        output: "dist/perspire/vdomSnapshot.html",
        plugin: yargv.plugin,
      }
    };
  }
  await vlm.updateToolsetConfig(vlm.toolset, toolsetConfigUpdate);
  return { command: exports.command, devDependencies };
};
