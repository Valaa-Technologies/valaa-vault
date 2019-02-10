exports.command = ".status/.type/.authollery/10-authollery";
exports.describe = "Display the authollery status";
exports.introduction = `${exports.describe}.`;

exports.disabled = (yargs) => (yargs.vlm.getPackageConfig("valaa", "type") !== "authollery")
    && `Workspace is not an authollery (is ${yargs.vlm.getPackageConfig("valaa", "type")})`;
exports.builder = (yargs) => yargs;

exports.handler = (yargv) => {
  const authollery = yargv.vlm.getValmaConfig("authollery");
  if (authollery) {
    console.log(`authollery stack: ${authollery.stack}`);
  } else {
    console.error(`valma-status: valma config authollery section not found (run 'vlm configure')`);
  }
};
