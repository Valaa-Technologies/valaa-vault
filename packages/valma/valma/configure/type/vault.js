exports.command = ".configure/.type/vault";
exports.describe = "Configure a Valaa Vault repository";
exports.introduction = `${exports.describe}.

A Valaa Vault is a monorepository containing many sub-packages. Its
main responsibility is to handle the development, assembly and
publishing of those packages.

Will add '@valos/toolset-vault' as devDependency.
Will set package.json .workspaces stanza.
`;

exports.builder = (yargs) => {
  const vlm = yargs.vlm;
  const current = vlm.getPackageConfig("workspaces", 0);
  return yargs.options({
    reconfigure: {
      alias: "r", type: "boolean",
      description: "Reconfigure all vault type configurations",
    },
    workspaces: {
      type: "string", default: current || "packages/*",
      interactive: {
        type: "input", when: !current ? "always" : "if-undefined",
        message: "Set package.json .workspaces stanza glob for yarn to manage.",
      }
    },
  });
};

exports.handler = async (yargv) => {
  const vlm = yargv.vlm;
  if (!vlm.getPackageConfig("devDependencies", "@valos/toolset-vault")) {
    await vlm.interact("yarn add -W --dev @valos/toolset-vault");
  }
  if (vlm.getPackageConfig("workspaces", 0) !== yargv.workspaces) {
    await vlm.updatePackageConfig({ workspaces: [yargv.workspaces] });
    await vlm.interact("yarn install");
  }
  return vlm.invoke(`.configure/.type/.vault/**/*`, { reconfigure: yargv.reconfigure });
};
