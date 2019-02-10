exports.vlm = { toolset: "@valos/toolset-authollery" };
exports.command = ".configure/.type/.authollery/@valos/toolset-authollery";
exports.describe = "Configure 'toolset-authollery' for an authollery workspace";
exports.introduction = `${exports.describe}.

Adds valma commands 'build-release' and 'deploy-release'.

Copies vault monorepo config file templates to this vault repository
root from package @valos/toolset-authollery directory templates/.*.`;

// Example template which displays the command name itself and package name where it is ran
// Only enabled inside package
exports.disabled = (yargs) => (yargs.vlm.getPackageConfig("valaa", "type") !== "authollery")
    && `Workspace is not an authollery (is ${yargs.vlm.getPackageConfig("valaa", "type")})`;
exports.builder = (yargs) => yargs.options({
  reconfigure: {
    alias: "r", type: "boolean",
    description: "Reconfigure 'toolset-authollery' config of this workspace.",
  },
});

exports.handler = (yargv) => {
  const vlm = yargv.vlm;
  const templates = vlm.path.join(__dirname, "../templates/{.,}*");
  vlm.info("Copying missing authollery config files", " from templates at:",
      vlm.theme.path(templates), "(will not clobber existing files)");
  vlm.shell.cp("-n", templates, ".");
};
