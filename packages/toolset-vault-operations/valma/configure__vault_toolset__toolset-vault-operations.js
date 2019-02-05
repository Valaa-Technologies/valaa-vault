exports.vlm = { toolset: "@valos/toolset-vault-operations" };
exports.command = ".configure/.type/.vault/.toolset/@valos/toolset-vault-operations";
exports.describe = "Configure the toolset 'toolset-vault-operations' for the current vault";
exports.introduction = `${exports.describe}.

This script makes the toolset 'toolset-vault-operations' available for
grabbing by repositories with valaa type 'vault'.`;

exports.disabled = (yargs) => !yargs.vlm.getToolsetConfig(yargs.vlm.toolset, "inUse");
exports.builder = (yargs) => yargs.options({
  reconfigure: {
    alias: "r", type: "boolean",
    description: "Reconfigure 'toolset-vault-operations' configurations of this repository.",
  },
});

exports.handler = (yargv) => {
  const vlm = yargv.vlm;
  return vlm && true;
};
