exports.vlm = { toolset: "@valos/toolset-vault-operations" };
exports.command = ".configure/.type/.vault/.selectable/@valos/toolset-vault-operations";
exports.describe = "Configure the vault toolset 'toolset-vault-operations'";
exports.introduction = `${exports.describe}.

This script makes the toolset 'toolset-vault-operations' selectable by
vault workspaces.`;

exports.disabled = (yargs) => !yargs.vlm.getToolsetConfig(yargs.vlm.toolset, "inUse")
    && "Can't configure 'toolset-vault-operations': not inUse or toolset config missing";
exports.builder = (yargs) => yargs.options({
  reconfigure: {
    alias: "r", type: "boolean",
    description: "Reconfigure 'toolset-vault-operations' config of this workspace.",
  },
});

exports.handler = (yargv) => {
  const vlm = yargv.vlm;
  return vlm && {
    command: exports.command,
    devDependencies: { "@valos/toolset-vault-operations": true },
  };
};
