exports.command = ".configure/.type/vault";
exports.describe = "Initialize vault workspace";
exports.introduction = `${exports.describe}.

A ValOS Vault is a monorepository containing many sub-packages. Its
main responsibility is to handle the development, assembly and
publishing of those packages.`;

exports.disabled = (yargs) => (yargs.vlm.getValOSConfig("type") !== "vault")
    && `Workspace is not a 'vault' (is '${yargs.vlm.getValOSConfig("type")}')`;
exports.builder = (yargs) => {
  const vlm = yargs.vlm;
  const current = (vlm.getPackageConfig("workspaces") || []).join(",");
  return yargs.options({
    reconfigure: {
      alias: "r", type: "boolean",
      description: "Reconfigure all 'vault' configurations of this workspace.",
    },
    workspaces: {
      type: "string", default: current || "packages/*",
      interactive: {
        type: "input", when: !current ? "always" : "if-undefined",
        message: "Set package.json .workspaces stanza globs as a comma-separated list.",
      }
    },
  });
};

exports.handler = async (yargv) => {
  const vlm = yargv.vlm;
  if ((vlm.getPackageConfig("workspaces") || []).join(",") !== yargv.workspaces) {
    await vlm.updatePackageConfig({ workspaces: [yargv.workspaces] });
    // await vlm.interact("yarn install");
  }
  return {
    devDependencies: { "@valos/type-vault": true },
    toolsetsUpdate: { "@valos/type-vault": { inUse: "always" } },
    success: true,
  };
};
