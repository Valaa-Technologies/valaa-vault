exports.command = ".configure/.type/workshop";
exports.describe = "Configure 'workshop' workspace";
exports.introduction = `${exports.describe}.

Each valos domain provides a workshop package which provides a set of
valma commands for defining and managing the domain. The workshops then:
1. shall provide domain package (de)registration via
   .configure/.<domain>/{,de}register-package
2. can provide new workspace types via .configure/.type/*
3. can provide new toolsets via
   .configure/{,.type/.<type>/,.domain/.<domain>/}.toolset/**/*

Notably the package (de)registration should provide means for newly
domain toolset packages to request the addition of their toolset
configure command to the domain workshop. Idiomatic example is a guided
issuance of a PR against the source control repository of the workshop
package.
`;

exports.disabled = (yargs) => (yargs.vlm.getValOSConfig("type") !== "workshop")
    && `Workspace is not a 'workshop' (is '${yargs.vlm.getValOSConfig("type")}')`;
exports.builder = (yargs) => yargs.options({
  reconfigure: {
    alias: "r", type: "boolean",
    description: "Reconfigure all 'workshop' configurations of this workspace.",
  },
});

exports.handler = async (yargv) => {
  const vlm = yargv.vlm;
  /*
  if (!vlm.getPackageConfig("devDependencies", "@valos/toolset-workshop")) {
    await vlm.interact("yarn add -W --dev @valos/toolset-workshop");
  }
  */
  return vlm.invoke(`.configure/.type/.workshop/**/*`, { reconfigure: yargv.reconfigure });
};
