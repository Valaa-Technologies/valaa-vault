exports.command = ".status/.type/.opspace/10-opspace";
exports.describe = "Display the opspace status";
exports.introduction = `${exports.describe}.`;

exports.disabled = (yargs) => (yargs.vlm.getValOSConfig("type") !== "opspace")
    && `Workspace is not an opspace (is ${yargs.vlm.getValOSConfig("type")})`;
exports.builder = (yargs) => yargs;

exports.handler = (yargv) => {
  const opspace = yargv.vlm.getValmaConfig("opspace");
  if (opspace) {
    console.log(`opspace stack: ${opspace.stack}`);
  } else {
    console.error(`valma-status: valma config opspace section not found (run 'vlm configure')`);
  }
};
