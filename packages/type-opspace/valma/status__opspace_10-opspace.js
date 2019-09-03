exports.command = ".status/.type/.opspace/10-opspace";
exports.brief = "display the workshop status";
exports.describe = "Display the opspace status";
exports.introduction = `
`;

exports.disabled = (yargs) => (yargs.vlm.getValOSConfig("type") !== "opspace")
    && `Workspace is not an opspace (is ${yargs.vlm.getValOSConfig("type")})`;
exports.builder = (yargs) => yargs;

exports.handler = (yargv) => {
  const opspaceConfig = yargv.vlm.getToolsetConfig("opspace");
  if (!opspaceConfig) {
    console.error(`valma-status: valma toolset opspace section not found (run 'vlm configure')`);
  } else {
    console.log(`opspace stack: ${opspaceConfig.stack}`);
  }
};
