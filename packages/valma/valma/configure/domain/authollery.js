exports.command = ".configure/.domain/authollery";
exports.describe = "Configure the 'authollery' domain for this workspace";
exports.introduction = `${exports.describe}.

Authollery domain includes all toolsets which are meant to be
dev-depended by autholleries. The purpose of autholleries is to have
a centralized, configurable, granular and versioned system for building
and deploying releases.

A release deployment is the process of making changes to a live remote
system. A deployment can modify external infrastructure code, update
configurations and upload new file content to the targeted live system.

Ideally each deployment would be fully atomic but as autholleries are
designed to be used against arbitrary systems this is often not
feasible. To overcome this limitation and still maintain consistency
following strategy is used:

1. the release process is divided to two stages which are separately
   initiated by valma commands 'build-release' and 'deploy-release'.
   This separation is to ensure eventual completion of deployments and
   importantly to facilitate the understanding of particular authollery
   release deployment process by allowing a DevOps to inspect and test
   the intermediate release build locally even if everything is fine.
2. The output of the 'build-release' stage is the release itself:
   an isolated set of files in a local directory (usually
   'dist/release/<version>'). These release files contain the diff-sets
   which the 'deploy-release' consumes. The release files are intended
   to be perused and understood by DevOps.
4. The release is divided into atomic, versioned sub-releases to ensure
   consistency during each point during the full deployment.
   Sub-releases have their own versions and can have (non-cyclic)
   dependencies to each other.
5. A single sub-release is typically created by a single valma toolset
   or tool with its own customized build-release detail commands.
6. build-release detail commands evaluate the local authollery
   modifications and compares them to the actually deployed state. This
   difference is used to construct the minimal set of atomic, locally
   persisted, individually versioned sub-releases.
7. deploy-release stage deploy each sub-release and ensures that
   a deployment for all dependents complete before their depending
   deployments are initiated.`;

exports.disabled = (yargs) => (yargs.vlm.getValOSConfig("domain") !== "authollery")
    && `Workspace domain is not 'authollery' (is '${
        yargs.vlm.getValOSConfig("domain")}')`;
exports.builder = (yargs) => yargs.options({
  reconfigure: {
    alias: "r", type: "boolean",
    description: "Reconfigure all 'authollery' domain config of this workspace.",
  },
});

exports.handler = async (yargv) => {
  const vlm = yargv.vlm;
  const type = vlm.getValOSConfig("type");
  const isTool = (type === "tool") ? true : undefined;
  const name = vlm.packageConfig.name;
  const simpleName = name.match(/([^/]*)$/)[1];
  if (isTool || (type === "toolset")) {
    await _createReleaseSubCommand("build");
    await _createReleaseSubCommand("deploy");
  }
  return vlm.invoke(`.configure/.domain/.authollery/**/*`, { reconfigure: yargv.reconfigure });

  function _createReleaseSubCommand (subName) {
    const isBuild = (subName === "build");
    return vlm.invoke("create-command", [`.release-${subName}/${isTool ? ".tool/" : ""}${name}`, {
      filename: `release-${subName}_${isTool ? "tool_" : ""}_${simpleName}.js`,
      brief: `${isBuild ? "Build" : "Deploy"} a sub-release`,
      export: true,

      header: `const authollery = require("@valos/toolset-authollery");\n\n`,
      "exports-vlm": `{ ${type}: "${name}" }`,
      describe: `${isBuild ? "Build" : "Deploy"} a sub-release of ${name}`,

      introduction: isTool
          ?
`This tool sub-release ${subName} command must be explicitly invoked by
toolsets which use this tool.`
          :
`When a release is being ${isBuild ? "built" : "deployed"
    } each active toolset must explicitly
invoke the ${subName} commands of all of its ${subName}able tools.`,

      disabled: isTool ? undefined :
`(yargs) => !yargs.vlm.getToolsetConfig(yargs.vlm.toolset, "inUse")`,

      builder:
`(yargs) => yargs.options({${!isTool ? "" : `
  toolset: yargs.vlm.createStandardToolsetOption(
      "The containing toolset of this tool release ${subName}"),`}
})${!isBuild ? `
  source: authollery.createStandardDeploySourceOption(
      yargs, "The source root release path of the whole deployment"),`
      : `
  target: authollery.createStandardBuildTargetOption(
      yargs, "The target root release path of the whole build"),
  force: { alias: "f", type: "boolean", description: "Allow building already deployed releases" },
  overwrite: { type: "boolean", description: "Allow overwriting existing local build files" },`}
})`,

      handler: isBuild
          ?
`async (yargv) => {
  const vlm = yargv.vlm;${isTool && `
  const toolset = yargv.toolset;`}
  const ${type}Version = yargv.overwrite ? undefined : await vlm.invoke(exports.command, ["--version"]);
  const { ${type}Config, ${type}ReleasePath } = authollery.prepareTool${isTool ? "" : "set"}Build(
      yargv, ${isTool && "toolset, "}vlm.${type}, "${simpleName}", ${type}Version);
  if (!${type}Config) return;

  vlm.shell.ShellString(${type}Version).to(vlm.path.join(${type}ReleasePath, "version-hash"));
  return;
};\n`
        :
`async (yargv) => {
  const vlm = yargv.vlm;${isTool && `
  const toolset = yargv.toolset;`}
  const { ${type}Config, ${type}ReleasePath } = authollery.locateTool${isTool ? "" : "set"}Release(
      yargv, ${isTool && "toolset, "}vlm.${type}, "${simpleName}");
  if (!${type}ReleasePath) return;

  const deployedReleaseHash = await vlm.readFile(vlm.path.join(${type}ReleasePath, "version-hash"));

  ${isTool
    ? "vlm.updateToolConfig(toolset, vlm.tool, { deployedReleaseHash });"
    : "vlm.updateToolsetConfig(vlm.toolset, { deployedReleaseHash });"
  }
  return;
};\n`,
    }]);
  }
};
