exports.command = ".configure/.type/authollery";
exports.describe = "Configure a Valaa authollery repository";
exports.introduction = `${exports.describe}.

Authollery is a portmanteau of AUTHority contrOLLEr repositoRY.
Autholleries are responsible for configuring, deploying, updating,
monitoring and diagnosing all types of live infrastructure resources
which relate to a particular Valaa authority.

Autholleries rely heavily on various toolsets to get their job done.

Will add '@valos/toolset-authollery' as devDependency.`;

exports.builder = (yargs) => yargs.options({
  reconfigure: {
    alias: "r", type: "boolean",
    description: "Reconfigure all authollery type configurations",
  },
});

exports.handler = async (yargv) => {
  const vlm = yargv.vlm;
  if (!vlm.getPackageConfig("devDependencies", "@valos/toolset-authollery")) {
    await vlm.interact("yarn add -W --dev @valos/toolset-authollery");
  }
  return vlm.invoke(`.configure/.type/.authollery/**/*`, { reconfigure: yargv.reconfigure });
};
