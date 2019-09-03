exports.vlm = { toolset: "@valos/toolset-domain" };
exports.command = ".configure/.toolset/@valos/toolset-domain";
exports.brief = "configure 'toolset-domain'";
exports.describe = "Configure the toolset 'toolset-domain' within the current workspace";
exports.introduction = `${exports.describe}.

As a toolset this script is automatically called by configure.`;

exports.disabled = (yargs) => !yargs.vlm.getToolsetConfig(yargs.vlm.toolset, "inUse")
    && `Toolset '${yargs.vlm.toolset}' not in use`;
exports.builder = (yargs) => yargs.options({
  ...yargs.vlm.createConfigureToolsetOptions(exports),
});

exports.handler = async (yargv) => {
  const vlm = yargv.vlm;
  const toolsetConfig = vlm.getToolsetConfig(vlm.toolset) || {};
  const domain = vlm.getValOSConfig("domain");
  const domainWorkshopPath = vlm.path.join(process.cwd(), "packages", domain.split("/")[1]);
  if (!vlm.shell.test("-d", domainWorkshopPath) && await vlm.inquireConfirm(
      `Create domain workshop workspace ${vlm.theme.package(domain)} at ${
          vlm.theme.path(domainWorkshopPath)}?`)) {
    vlm.shell.mkdir("-p", domainWorkshopPath);
    vlm.shell.pushd(domainWorkshopPath);
    await vlm.invoke(`init`, {
      description: `The domain '${domain}' workshop`,
      valos: { type: "workshop", domain },
      devDependencies: false,
    });
    vlm.shell.popd();
  }
  const toolsetConfigUpdate = {}; // Construct a toolset config update or bail out.
  vlm.updateToolsetConfig(vlm.toolset, toolsetConfigUpdate);
  const selectionResult = await vlm.configureToolSelection(yargv, toolsetConfig);
  return { success: true, ...selectionResult };
};
