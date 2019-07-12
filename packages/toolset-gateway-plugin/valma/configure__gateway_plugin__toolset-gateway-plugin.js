exports.vlm = { toolset: "@valos/toolset-gateway-plugin" };
exports.command = ".configure/.type/.gateway-plugin/@valos/toolset-gateway-plugin";
exports.describe = "Configure a 'toolset-gateway-plugin' workspace";
exports.introduction = `${exports.describe}.

`;

exports.disabled = (yargs) => !yargs.vlm.getToolsetConfig(yargs.vlm.toolset, "inUse")
    && "Can't configure 'toolset-gateway-plugin': not inUse or toolset config missing";
exports.builder = (yargs) => yargs.options({
  reconfigure: {
    alias: "r", type: "boolean",
    description: "Reconfigure 'toolset-gateway-plugin' config of this workspace.",
  },
});

exports.handler = async (yargv) => {
  const vlm = yargv.vlm;
  const templates = vlm.path.join(__dirname, "../templates/{.,}*");
  vlm.info("Copying missing gateway-plugin config files", " from templates at:",
      vlm.theme.path(templates), "(will not clobber existing files)");
  vlm.shell.cp("-n", templates, ".");

  const devDependencies = {};
  if (!vlm.getPackageConfig("devDependencies", "@valos/tools")) {
    if (await vlm.inquireConfirm(`Install @valos/tools in devDependencies?`)) {
      devDependencies["@valos/tools"] = true;
    }
  }
  return { command: exports.command, devDependencies };
};