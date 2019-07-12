exports.command = ".configure/.type/toolset";
exports.describe = "Configure a 'toolset' workspace";
exports.introduction = `${exports.describe}.

A valma toolset is a package which provides various resources for
a depending repository with the ability to have repository specific
configurations in their 'toolsets.json'.
These resources might be new valma commands, file templates,
dependencies to other valma toolsets and tools, to external tools or
to plain javascript libraries; anything that can be expressed in a
package really.

The defining quality of a toolset is its ability to have repository
specific configuration which all toolset commands and even other
javascript files can access to customize their behaviour. Additionally
toolsets appear in configuration listings and can be selectively
enabled or disabled on a repository.

A valma toolsets are added as regular devDependencies and configured
by running 'vlm configure' afterwards.`;

exports.disabled = (yargs) => (yargs.vlm.getValOSConfig("type") !== "toolset")
    && `Workspace is not a 'toolset' (is '${yargs.vlm.getValOSConfig("type")}')`;
exports.builder = (yargs) => yargs.options({
  reconfigure: {
    alias: "r", type: "boolean",
    description: "Reconfigure all 'toolset' configurations of this workspace.",
  },
  restrict: {
    type: "string",
    description: `Restrict this toolset to a particular valos type (clear for no restriction):`,
    interactive: { type: "input", when: "if-undefined" },
  },
  selectable: {
    type: "any", default: true,
    description: `Make this toolset grabbable and stowable (falsy for always-on):`,
    interactive: { type: "confirm", when: "if-undefined" },
  },
});

exports.handler = async (yargv) => {
  const vlm = yargv.vlm;
  const simpleName = vlm.packageConfig.name.match(/([^/]*)$/)[1];
  const commandName = `.configure/${yargv.restrict ? `.type/.${yargv.restrict}/` : ""}${
    yargv.selectable ? ".selectable/" : ""}${vlm.packageConfig.name}`;
  await vlm.invoke("create-command", [{
    filename: `configure__${yargv.restrict ? yargv.restrict : ""}${
        yargv.selectable ? "_toolset_" : "_"}_${simpleName}.js`,
    export: true, skeleton: true,
    brief: "toolset configure",
    "exports-vlm": `{ toolset: "${vlm.packageConfig.name}" }`,
    describe: `Configure the toolset '${simpleName}' for the current ${
        yargv.restrict || "repository"}`,

    introduction: yargv.restrict
        ? `This script makes the toolset '${simpleName}' selectable by ${
          yargv.restrict} workspaces.`
        : `This script makes the toolset '${simpleName}' selectable by all workspaces.`,

    disabled: `(yargs) => !yargs.vlm.getToolsetConfig(yargs.vlm.toolset, "inUse")`,
    builder: `(yargs) => yargs.options({
  reconfigure: {
    alias: "r", type: "boolean",
    description: "Reconfigure '${simpleName}' config of this workspace.",
  },
})`,
  }, commandName]);
  if (yargv.restrict === "opspace") {
    await createReleaseSubCommand(vlm, "toolset", vlm.packageConfig.name, "build");
    await createReleaseSubCommand(vlm, "toolset", vlm.packageConfig.name, "deploy");
  }
  return vlm.invoke(`.configure/.type/.toolset/**/*`, { reconfigure: yargv.reconfigure });
};

function createReleaseSubCommand (vlm, type, name, subName) {
  const simpleName = name.match(/([^/]*)$/)[1];
  const isTool = (type === "tool") ? true : undefined;
  const isBuild = (subName === "build");
  return vlm.invoke("create-command", [`.release-${subName}/${isTool ? ".tool/" : ""}${name}`, {
    filename: `release-${subName}_${isTool ? "tool_" : ""}_${simpleName}.js`,
    brief: `${isBuild ? "Build" : "Deploy"} a sub-release`,
    export: true,

    header: `const opspace = require("@valos/toolset-opspace");\n\n`,
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
source: opspace.createStandardDeploySourceOption(
    yargs, "The source root release path of the whole deployment"),`
    : `
target: opspace.createStandardBuildTargetOption(
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
const { ${type}Config, ${type}ReleasePath } = opspace.prepareTool${isTool ? "" : "set"}Build(
    yargv, ${isTool && "toolset, "}vlm.${type}, "${simpleName}", ${type}Version);
if (!${type}Config) return;

vlm.shell.ShellString(${type}Version).to(vlm.path.join(${type}ReleasePath, "version-hash"));
return;
};\n`
      :
`async (yargv) => {
const vlm = yargv.vlm;${isTool && `
const toolset = yargv.toolset;`}
const { ${type}Config, ${type}ReleasePath } = opspace.locateTool${isTool ? "" : "set"}Release(
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
