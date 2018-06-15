exports.command = ".configure/.type/.vault/copy-config-templates";
exports.summary = "Initializes vault monorepo config files from templates";
exports.describe = `${exports.summary}.
Config templates are located in the package @valos/valma-toolset-vault
directory templates/*.
`;

exports.builder = (yargs) => yargs;
exports.handler = (yargv) => {
  const vlm = yargv.vlm;
  const sourceGlob = vlm.path.join(__dirname, "../templates/{.,}*");
  console.log("Copying templates from ", sourceGlob, "without overwriting existing files");
  vlm.shell.cp("-n", sourceGlob, ".");
};
