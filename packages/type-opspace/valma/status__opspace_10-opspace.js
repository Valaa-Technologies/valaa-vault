const typeToolset = require("@valos/type-toolset");

exports.vlm = { toolset: "@valos/type-opspace" };
exports.command = ".status/.type/.opspace/10-opspace";
exports.brief = "display the domain status";
exports.describe = "Display the opspace status";
exports.introduction = `
`;

exports.disabled = (yargs) => typeToolset.checkToolsetDisabled(yargs.vlm, exports);
exports.builder = (yargs) => yargs;

exports.handler = (yargv) => {
  const opspaceConfig = yargv.vlm.getToolsetConfig("opspace");
  if (!opspaceConfig) {
    console.error(`valma-status: valma toolset opspace section not found (run 'vlm configure')`);
  } else {
    console.log(`opspace stack: ${opspaceConfig.stack}`);
  }
};
