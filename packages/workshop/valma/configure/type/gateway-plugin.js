exports.command = ".configure/.type/gateway-plugin";
exports.describe = "Configure a 'gateway-plugin' workspace";
exports.introduction = `${exports.describe}.

Will add '@valos/toolset-gateway-plugin' as devDependency.`;

exports.disabled = (yargs) => (yargs.vlm.getValOSConfig("type") !== "gateway-plugin")
    && `Workspace is not a 'gateway-plugin' (is '${yargs.vlm.getValOSConfig("type")}')`;
exports.builder = (yargs) => yargs.options({
  reconfigure: {
    alias: "r", type: "boolean",
    description: "Reconfigure all 'gateway-plugin' configurations of this workspace.",
  },
});

exports.handler = async (yargv) => {
  const vlm = yargv.vlm;
  if (!vlm.getPackageConfig("devDependencies", "@valos/toolset-gateway-plugin")) {
    await vlm.interact("yarn add -W --dev @valos/toolset-gateway-plugin");
  }
  return vlm.invoke(`.configure/.type/.gateway-plugin/**/*`, { reconfigure: yargv.reconfigure });
};
