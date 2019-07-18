exports.vlm = { toolset: "@valos/type-gateway-plugin" };
exports.command = ".configure/.type/.gateway-plugin/@valos/type-gateway-plugin";
exports.describe = "Configure the 'type-gateway-plugin' toolset";
exports.introduction = `${exports.describe}.

`;

exports.disabled = (yargs) => (yargs.vlm.getValOSConfig("type") !== "gateway-plugin")
    && `Workspace is not a gateway-plugin (is ${yargs.vlm.getValOSConfig("type")})`;
exports.builder = (yargs) => yargs.options({
  ...yargs.vlm.createConfigureToolsetOptions(exports),
});

exports.handler = async (yargv) => {
  const vlm = yargv.vlm;
  const toolsetConfig = vlm.getToolsetConfig(vlm.toolset);
  if (!toolsetConfig) return undefined;

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

  const selectionResult = await vlm.configureToolSelection(yargv, toolsetConfig);
  return { command: exports.command, devDependencies, ...selectionResult };
};
