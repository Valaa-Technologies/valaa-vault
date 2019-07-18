exports.command = ".configure/.type/gateway-plugin";
exports.describe = "Initialize gateway-plugin workspace";
exports.introduction = `${exports.describe}.

Gateway-plugin extends inspire/perspire gateways with various types of
functionalities, including new type schemas, media decoders, protocol
schemes, external APIs, valosheath APIs, etc.`;

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
  if (!vlm.getPackageConfig("devDependencies", "@valos/type-gateway-plugin")) {
    await vlm.interact("yarn add -W --dev @valos/type-gateway-plugin");
  }
  return vlm.invoke(`.configure/.type/.gateway-plugin/**/*`, { reconfigure: yargv.reconfigure });
};
