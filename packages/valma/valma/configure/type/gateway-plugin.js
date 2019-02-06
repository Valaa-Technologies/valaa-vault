exports.command = ".configure/.type/gateway-plugin";
exports.describe = "Configure a ValOS gateway plugin repository";
exports.introduction = `${exports.describe}.

Will add '@valos/toolset-gateway-plugin' as devDependency.`;

exports.builder = (yargs) => yargs.options({
  reconfigure: {
    alias: "r", type: "boolean",
    description: "Reconfigure all 'gateway-plugin' type configurations of this repository.",
  },
});

exports.handler = async (yargv) => {
  const vlm = yargv.vlm;
  if (!vlm.getPackageConfig("devDependencies", "@valos/toolset-gateway-plugin")) {
    await vlm.interact("yarn add -W --dev @valos/toolset-gateway-plugin");
  }
  return vlm.invoke(`.configure/.type/.gateway-plugin/**/*`, { reconfigure: yargv.reconfigure });
};
