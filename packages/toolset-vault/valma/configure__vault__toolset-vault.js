exports.vlm = { toolset: "@valos/toolset-vault" };
exports.command = ".configure/.type/.vault/@valos/toolset-vault";
exports.describe = "Configure 'toolset-vault' for a vault workspace";
exports.introduction = `${exports.describe}.

Adds valma commands 'assemble-packages' and 'publish-packages'.

Copies vault monorepo config file templates to this vault repository
root from package @valos/toolset-vault directory templates/.*.`;

// Example template which displays the command name itself and package name where it is ran
// Only enabled inside package
exports.disabled = (yargs) => (yargs.vlm.getPackageConfig("valaa", "type") !== "vault")
    && `Workspace is not a vault (is ${yargs.vlm.getPackageConfig("valaa", "type")})`;
exports.builder = (yargs) => yargs.options({
  reconfigure: {
    alias: "r", type: "boolean",
    description: "Reconfigure 'toolset-vault' config of this workspace.",
  },
});

exports.handler = async (yargv) => {
  const vlm = yargv.vlm;
  const templates = vlm.path.join(__dirname, "../templates/{.,}*");
  vlm.info("Copying vault template files from ", vlm.theme.path(templates),
      "(will not clobber existing files)");
  vlm.shell.cp("-n", templates, ".");
  const hardcodedVDONFiles = ["README", "STYLE"];
  for (const vdonFile of hardcodedVDONFiles) {
    await vlm.shell
        .exec(`vlm --markdown . require @valos/toolset-vault/template.vdon/${vdonFile}.vdon`)
        .to(`${vdonFile}.md`);
  }

  // TODO(iridian): Convert into dynamic listing maybe?
  const hardcodedDotFiles = ["gitignore", "npmignore", "npmrc"];
  for (const dotFile of hardcodedDotFiles) {
    vlm.shell.cp("-n", vlm.path.join(__dirname, "../template.dots", dotFile), `.${dotFile}`);
  }
};
