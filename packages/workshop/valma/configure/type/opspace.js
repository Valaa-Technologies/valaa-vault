exports.command = ".configure/.type/opspace";
exports.describe = "Initialize opspace workspace";
exports.introduction = `${exports.describe}.

Opspaces are responsible for configuring, deploying, updating,
monitoring and diagnosing all types of live infrastructure resources.

Opspaces rely heavily on various toolsets to get their job done.`;

exports.disabled = (yargs) => (yargs.vlm.getValOSConfig("type") !== "opspace")
    && `Workspace is not an 'opspace' (is '${yargs.vlm.getValOSConfig("type")}')`;
exports.builder = (yargs) => yargs.options({
  reconfigure: {
    alias: "r", type: "boolean",
    description: "Reconfigure all 'opspace' configurations of this workspace.",
  },
});

exports.handler = async (yargv) => {
  const vlm = yargv.vlm;
  if (!vlm.getPackageConfig("devDependencies", "@valos/type-opspace")) {
    await vlm.interact("yarn add -W --dev @valos/type-opspace");
  }
  return vlm.invoke(`.configure/.type/.opspace/**/*`, { reconfigure: yargv.reconfigure });
};
