exports.vlm = { toolset: "@valos/type-vault" };
exports.command = ".configure/.type/.vault/@valos/type-vault";
exports.brief = "configure 'type-vault'";
exports.describe = "Configure the 'type-vault' toolset";
exports.introduction = `${exports.describe}.

Adds valma commands 'assemble-packages' and 'publish-packages'.

Copies vault monorepo config file templates to this vault workspace
root from package @valos/type-vault directory templates/.*.`;

// Example template which displays the command name itself and package name where it is ran
// Only enabled inside package
exports.disabled = (yargs) => (yargs.vlm.getValOSConfig("type") !== "vault")
    && `Workspace is not a vault (is ${yargs.vlm.getValOSConfig("type")})`;
exports.builder = (yargs) => yargs.options({
  ...yargs.vlm.createConfigureToolsetOptions(exports),
});

exports.handler = async (yargv) => {
  const vlm = yargv.vlm;
  const toolsetConfig = vlm.getToolsetConfig(vlm.toolset);
  if (!toolsetConfig) return undefined;

  const templates = vlm.path.join(__dirname, "../templates/{.,}*");
  vlm.info("Copying vault template files from ", vlm.theme.path(templates),
      "(will not clobber existing files)");
  vlm.shell.cp("-n", templates, ".");
  const hardcodedVDONFiles = ["README", "STYLE"];
  for (const vdonFile of hardcodedVDONFiles) {
    vlm.shell
        .exec(`vlm --markdown . require @valos/type-vault/template.vdon/${vdonFile}.vdon`,
            { silent: true })
        .to(`${vdonFile}.md`);
  }

  // TODO(iridian): Convert into dynamic listing maybe?
  const hardcodedDotFiles = ["gitignore", "npmignore", "npmrc"];
  for (const dotFile of hardcodedDotFiles) {
    vlm.shell.cp("-n", vlm.path.join(__dirname, "../template.dots", dotFile), `.${dotFile}`);
  }

  const config = await vlm.getPackageConfig();
  const [version, preid] = config.version.split("-");
  const branchName = preid ? "prerelease" : "release";

  if (!vlm.shell.test("-f", "lerna.json")) {
    const lerna = {
      version: config.version,
      lerna: "3.15.0",
      npmClient: "yarn",
      useWorkspaces: true,
      command: {
        // If patch version is specified and not 0, set up (pre)patch bump.
        // Otherwise bump (pre)minor.
        version: {
          bump: `${preid ? "pre" : ""}${
              (version.split(".")[2] || "0") !== "0" ? "patch" : "minor"}`,
          preid: preid || "",
          allowBranch: `${branchName}/*`,
        }
      },
    };
    vlm.shell.ShellString(JSON.stringify(lerna, null, 2)).to("./lerna.json");
  }
  const selectionResult = await vlm.configureToolSelection(yargv, toolsetConfig);

  const hadGit = vlm.shell.test("-d", ".git");
  if (!hadGit && await vlm.inquireConfirm("Initialize git repository?")) {
    await vlm.interact("git init");
    const newOrigin = (await vlm.inquireText(
        `git remote "origin" to add (leave empty to skip):`) || "").trim();
    if (newOrigin) {
      await vlm.interact(`git remote add origin ${newOrigin}`);
      await vlm.interact(`git fetch`);
      try {
        await vlm.interact(`git checkout master`);
        if (!(await vlm.inquireConfirm(
            `Remote repository not empty. Continue appending on top of 'master'?`))) {
          throw new Error("Aborted by user due to non-empty 'master'. No cleanup done.");
        }
      } catch (error) {
        if ((await vlm.delegate("git branch -a") || "").trim()) {
          throw new Error(
              "Invalid, initialized git state: branches exist but 'git checkout master' failed");
        }
      }
    }
    await vlm.interact("git add -A");
    await vlm.interact(`git commit -a -m v${config.version}`);
    if (await vlm.inquireConfirm(`Set up initial ${branchName} branch and its annotated tag?`)) {
      await vlm.interact(`git tag -a -m v${config.version} v${config.version}`);
      await vlm.interact(`git checkout -b ${branchName}/${
          config.version.split(".").slice(0, 2).join(".")}`);
    }
  }
  return { command: exports.command, ...selectionResult };
};
