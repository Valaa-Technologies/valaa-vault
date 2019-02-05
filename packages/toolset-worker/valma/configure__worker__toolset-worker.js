exports.vlm = { toolset: "@valos/toolset-worker" };
exports.command = ".configure/.type/.worker/@valos/toolset-worker";
exports.describe = "Configure the toolset 'toolset-worker' for the current repository";
exports.introduction = `${exports.describe}.

This script makes the toolset 'toolset-worker' available for
grabbing by repositories with valaa type 'worker'.`;

exports.disabled = (yargs) => !yargs.vlm.getToolsetConfig(yargs.vlm.toolset, "inUse");
exports.builder = (yargs) => {
  const toolsetConfig = yargs.vlm.getToolsetConfig(yargs.vlm.toolset) || {};
  return yargs.options({
    reconfigure: {
      alias: "r", type: "boolean",
      description: "Reconfigure 'toolset-worker' configurations of this repository.",
    },
    rootPartitionURI: {
      type: "string", default: toolsetConfig.rootPartitionURI || undefined,
      interactive: { type: "input", when: yargs.vlm.reconfigure ? "always" : "if-undefined" },
      summary: "The initial perspire gateway partition URI",
      description: "The initial view will be spawned based on this as well."
          + "If the URI contains fragment resource part it will be used as the view root."
          + "Otherwise the partition root entity will be used.",
    },
    plugin: {
      type: "string", array: true, default: toolsetConfig.plugins || [],
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

  if (!vlm.getPackageConfig("devDependencies", "@valos/inspire")) {
    if (await vlm.inquireConfirm(`Install @valos/inspire in devDependencies?`)) {
      await vlm.interact("yarn add -W --dev @valos/inspire");
    }
  }

  const toolsetConfigUpdate = { ...vlm.getToolsetConfig(vlm.toolset) };
  toolsetConfigUpdate.rootPartitionURI = yargv.rootPartitionURI;
  toolsetConfigUpdate.plugins = yargv.plugin;
  if (yargv.reconfigure || !(toolsetConfigUpdate.commands || {}).perspire) {
    toolsetConfigUpdate.commands = toolsetConfigUpdate.commands || {};
    toolsetConfigUpdate.commands.perspire = {
      options: {
        keepalive: 15,
        output: "dist/perspire/vdomSnapshot.html",
      }
    };
  }
  return vlm.updateToolsetConfig(vlm.toolset, toolsetConfigUpdate);
};
