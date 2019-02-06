exports.vlm = { toolset: "@valos/toolset-gateway-plugin" };
exports.command = ".configure/.type/.worker/@valos/toolset-gateway-plugin";
exports.describe = "Configure the toolset 'toolset-gateway-plugin' for the current repository";
exports.introduction = `${exports.describe}.

`;

exports.disabled = (yargs) => !yargs.vlm.getToolsetConfig(yargs.vlm.toolset, "inUse");
exports.builder = (yargs) => {
  const toolsetConfig = yargs.vlm.getToolsetConfig(yargs.vlm.toolset) || {};
  console.log("current toolset config", toolsetConfig);
  return yargs.options({
    reconfigure: {
      alias: "r", type: "boolean",
      description: "Reconfigure 'toolset-gateway-plugin' configurations of this repository.",
    },
  });
};

exports.handler = async (yargv) => {
  const vlm = yargv.vlm;
  const templates = vlm.path.join(__dirname, "../templates/{.,}*");
  vlm.info("Copying missing gateway-plugin config files", " from templates at:",
      vlm.theme.path(templates), "(will not clobber existing files)");
  vlm.shell.cp("-n", templates, ".");

  if (!vlm.getPackageConfig("devDependencies", "@valos/tools")) {
    if (await vlm.inquireConfirm(`Install @valos/tools in devDependencies?`)) {
      await vlm.interact("yarn add -W --dev @valos/tools");
    }
  }
};
