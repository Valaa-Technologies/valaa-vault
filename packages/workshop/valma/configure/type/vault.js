exports.command = ".configure/.type/vault";
exports.describe = "Initialize vault workspace";
exports.introduction =
`A vault is a monorepository which contains multiple workspaces of
various types. Vaults are used to group packages with high cohesion
together so that typical feature development, testing and deployment
workflows can be done within a single repository when feasible.`;

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
