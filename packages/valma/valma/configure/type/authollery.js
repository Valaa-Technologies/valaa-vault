exports.command = ".configure/.type/authollery";
exports.describe = "Configure an 'authollery' workspace";
exports.introduction = `${exports.describe}.

Authollery is a portmanteau of AUTHority contrOLLEr repositoRY.
Autholleries are responsible for configuring, deploying, updating,
monitoring and diagnosing all types of live infrastructure resources
which relate to a particular Valaa authority.

Autholleries rely heavily on various toolsets to get their job done.

Will add '@valos/toolset-authollery' as devDependency.`;

exports.disabled = (yargs) => (yargs.vlm.getPackageConfig("valaa", "type") !== "authollery")
    && `Workspace is not an 'authollery' (is '${yargs.vlm.getPackageConfig("valaa", "type")}')`;
exports.builder = (yargs) => yargs.options({
  reconfigure: {
    alias: "r", type: "boolean",
    description: "Reconfigure all 'authollery' type config of this workspace.",
  },
});

exports.handler = async (yargv) => {
  const vlm = yargv.vlm;
  if (!vlm.getPackageConfig("devDependencies", "@valos/toolset-authollery")) {
    await vlm.interact("yarn add -W --dev @valos/toolset-authollery");
  }
  return vlm.invoke(`.configure/.type/.authollery/**/*`, { reconfigure: yargv.reconfigure });
};
