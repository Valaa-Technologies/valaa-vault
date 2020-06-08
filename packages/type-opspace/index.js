const { toRestrictorPath, toSimpleRestrictor } = require("valma");
const {
  checkToolsetDisabled, checkToolDisabled, createToolToolsetOption,
} = require("@valos/type-toolset");

module.exports = {
  checkToolsetDisabled, // forward exports
  checkToolDisabled, // forward exports

  draftBuildToolsetCommand,
  draftBuildToolCommand,
  draftDeployToolsetCommand,
  draftDeployToolCommand,

  createBuildToolsetOptions,
  createBuildToolOptions,
  createDeployToolsetOptions,
  createDeployToolOptions,

  prepareToolsetBuild,
  prepareToolBuild,
  locateToolsetRelease,
  locateToolRelease,
};

function draftBuildToolsetCommand (vlm, name) {
  return _draftReleaseSubCommand(vlm, "build", "toolset", name);
}

function draftBuildToolCommand (vlm, name) {
  return _draftReleaseSubCommand(vlm, "build", "tool", name);
}

function draftDeployToolsetCommand (vlm, name) {
  return _draftReleaseSubCommand(vlm, "deploy", "toolset", name);
}

function draftDeployToolCommand (vlm, name) {
  return _draftReleaseSubCommand(vlm, "deploy", "tool", name);
}

function _draftReleaseSubCommand (vlm, primary, kind, name, restriction = {}) {
  const simpleName = name.match(/([^/]*)$/)[1];
  const isTool = (kind === "tool") ? true : "";
  const capPrimary = `${primary[0].toUpperCase()}${primary.slice(1)}`;
  const capKind = `${kind[0].toUpperCase()}${kind.slice(1)}`;
  const isBuild = (primary === "build");
  return vlm.invoke("draft-command", [{
    filename: `release-${primary}_${kind}s${toSimpleRestrictor(restriction)}__${simpleName}.js`,
    brief: `${capPrimary} a sub-release`,
    export: true,
    confirm: true,
    header:
`const typeOpspace = require("@valos/type-opspace");

`,
    "exports-vlm": `{ ${kind}: "${name}" }`,
    describe: `${capPrimary} a sub-release of ${name}`,
    introduction: isTool
        ?
`This tool sub-release ${primary} command must be explicitly invoked by
toolsets which use this tool.`
        :
`When a release is being ${isBuild ? "built" : "deployed"
  } each active toolset must explicitly
invoke the ${primary} commands of all of its ${primary}able tools.`,

    disabled:
`(yargs) => typeOpspace.check${capKind}Disabled(yargs.vlm, exports)`,
    builder:
`(yargs) => yargs.options({
  ...typeOpspace.create${capPrimary}${capKind}Options(yargs.vlm, exports),
})`,
    handler: isBuild
        ? _createBuildHandlerBody()
        : _createDeployHandlerBody(),
  }, `.release-${primary}/.${kind}s/${toRestrictorPath(restriction)}${name}`]);

  function _createBuildHandlerBody () {
    return `async (yargv) => {
  const vlm = yargv.vlm;${isTool && `
  const toolset = yargv.toolset;`}
  const ${kind}Version = yargv.overwrite ? undefined
      : await vlm.invoke(exports.command, ["--version"]);
  const { ${kind}Config, ${kind}ReleasePath } = typeOpspace.prepare${
      capKind}Build(yargv, ${isTool && "toolset, "}vlm.${kind}, "${
      simpleName}", ${kind}Version);
  if (!${kind}Config) return { success: false };

  vlm.shell.ShellString(${kind}Version).to(vlm.path.join(${
      kind}ReleasePath, "version-hash"));
  return { success: true, ${kind}ReleasePath, ${kind}Version };
}`;
  }

  function _createDeployHandlerBody () {
    return `async (yargv) => {
  const vlm = yargv.vlm;${isTool && `
  const toolset = yargv.toolset;`}
  const { ${kind}Config, ${kind}ReleasePath } = typeOpspace.locate${
      capKind}Release(yargv, ${isTool && "toolset, "}vlm.${kind}, "${simpleName}");
  if (!${kind}ReleasePath) return { success: false };

  const deployedReleaseHash = await vlm.readFile(
      vlm.path.join(${kind}ReleasePath, "version-hash"));

  ${isTool
      ? "vlm.updateToolConfig(toolset, vlm.tool, { deployedReleaseHash });"
      : "vlm.updateToolsetConfig(vlm.toolset, { deployedReleaseHash });"
  }
  return { success: true, ${kind}ReleasePath, deployedReleaseHash };
}`;
  }
}

function createBuildToolsetOptions (vlm, toolsetExports) {
  return {
    ..._createBuildOptions(vlm, "toolset", toolsetExports),
  };
}

function createBuildToolOptions (vlm, toolExports) {
  return {
    toolset: createToolToolsetOption(vlm, toolExports.vlm.tool, "build"),
    ..._createBuildOptions(vlm, "tool", toolExports),
  };
}

function createDeployToolsetOptions (vlm, toolsetExports) {
  return {
    ..._createDeployOptions(vlm, "toolset", toolsetExports),
  };
}

function createDeployToolOptions (vlm, toolExports) {
  return {
    toolset: createToolToolsetOption(vlm, toolExports.vlm.tool, "deploy"),
    ..._createDeployOptions(vlm, "tool", toolExports),
  };
}

function _createBuildOptions (vlm) {
  return {
    target: {
      type: "string", default: vlm.releasePath,
      description: "The target path for the release build",
      interactive: { type: "input", when: "if-undefined" },
    },
    force: { alias: "f", type: "boolean", description: "Allow building already deployed releases" },
    overwrite: { type: "boolean", description: "Allow overwriting existing local build files" },
  };
}

function _createDeployOptions (vlm) {
  return {
    source: {
      type: "string", default: vlm.releasePath,
      description: "The source path of the built release",
      interactive: {
        type: "input", when: "if-undefined",
        confirm: value => !!vlm.shell.test("-d", value),
      },
    },
  };
}

/**
 * Validates toolset build pre-conditions and returns the toolset target dist path where the
 * actual build will be placed.
 *
 * @param {*} toolsetName
 * @param {*} releasePath
 * @returns
 */
function prepareToolsetBuild (yargv, toolsetName, toolsetDescription = "toolset",
    desiredReleaseHash) {
  const vlm = yargv.vlm;
  const logger = vlm.tailor({ contextCommand: `build-release/${toolsetName}` });
  const releasePath = yargv.target;
  if (!vlm.shell.test("-d", releasePath)) {
    throw new Error(`${vlm.contextCommand}: releasePath directory '${
        vlm.theme.path(releasePath)}' missing`);
  }
  const toolsetConfig = vlm.getToolsetConfig(toolsetName);
  if (!toolsetConfig) return {};
  if (desiredReleaseHash && (toolsetConfig.deployedReleaseHash === desiredReleaseHash)) {
    logger.info(`${vlm.theme.bold(`Skipping the ${toolsetDescription} build`)
        } of already deployed release:`, vlm.theme.version(desiredReleaseHash));
    return {};
  }
  const simpleToolsetName = toolsetName.replace(/\//g, "_");
  const toolsetReleasePath = vlm.path.join(releasePath, simpleToolsetName);
  logger.info(`Building ${toolsetDescription} release in`, vlm.theme.path(toolsetReleasePath));
  vlm.shell.rm("-rf", toolsetReleasePath);
  vlm.shell.mkdir("-p", toolsetReleasePath);
  vlm.toolset = toolsetName;
  return { toolsetConfig, toolsetReleasePath };
}

function prepareToolBuild (yargv, toolsetName, toolName,
    toolDescription = "tool", desiredReleaseHash) {
  const vlm = yargv.vlm;
  const logger = vlm.tailor({ contextCommand: `.release-build/${toolName}` });
  const toolConfig = vlm.getToolConfig(toolsetName, toolName);
  if (!toolConfig) return {};
  if (desiredReleaseHash && (toolConfig.deployedReleaseHash === desiredReleaseHash)) {
    logger.info(`${vlm.theme.bold(`Skipping the ${toolDescription} build`)
        } of already deployed release within toolset ${vlm.theme.package(toolsetName)}:`,
        vlm.theme.version(desiredReleaseHash));
    return {};
  }
  const simpleToolsetName = toolsetName.replace(/\//g, "_");
  const simpleToolName = toolName.replace(/\//g, "_");
  const toolReleasePath = vlm.path.join(yargv.target, simpleToolsetName, simpleToolName);
  logger.info(`Building ${toolDescription} release in '${vlm.theme.path(toolReleasePath)}'`);
  vlm.shell.rm("-rf", toolReleasePath);
  vlm.shell.mkdir("-p", toolReleasePath);
  return { toolConfig, toolReleasePath };
}

function locateToolsetRelease (yargv, toolsetName, toolsetDescription = "toolset") {
  const vlm = yargv.vlm;
  const logger = vlm.tailor({ contextCommand: `.release-deploy/${toolsetName}` });
  const releasePath = yargv.source;
  const toolsetConfig = vlm.getToolsetConfig(toolsetName);
  if (!toolsetConfig) {
    throw new Error(`${vlm.contextCommand}: toolsets.json:['${
        vlm.theme.package(toolsetName)}'] missing`);
  }
  if (!vlm.shell.test("-d", releasePath)) {
    throw new Error(`${vlm.contextCommand}: releasePath '${
        vlm.theme.path(releasePath)}' missing`);
  }
  const simpleToolsetName = toolsetName.replace(/\//g, "_");
  const toolsetReleasePath = vlm.path.join(releasePath, simpleToolsetName);
  if (!vlm.shell.test("-d", toolsetReleasePath)) {
    logger.ifVerbose(1)
        .info(`Skipping ${toolsetDescription} deploy: no release at '${
            vlm.theme.path(toolsetReleasePath)}'`);
    return {};
  }
  logger.info(`Deploying ${toolsetDescription} release from '${
      vlm.theme.path(toolsetReleasePath)}'`);
  vlm.toolset = toolsetName;
  return { toolsetConfig, toolsetReleasePath };
}

function locateToolRelease (yargv, toolsetName, toolName, toolDescription = "tool") {
  const vlm = yargv.vlm;
  const logger = vlm.tailor({ contextCommand: `deploy-release/${toolName}` });
  const releasePath = yargv.source;
  const toolConfig = vlm.getToolConfig(toolsetName, toolName);
  const simpleToolsetName = toolsetName.replace(/\//g, "_");
  const simpleToolName = toolName.replace(/\//g, "_");
  const toolReleasePath = vlm.path.join(releasePath, simpleToolsetName, simpleToolName);
  if (!vlm.shell.test("-d", toolReleasePath)) {
    logger.ifVerbose(1)
        .info(`Skipping ${toolDescription} deploy: no release at '${
            vlm.theme.path(toolReleasePath)}'`);
    return {};
  }
  logger.info(`Deploying ${toolDescription} release from '${vlm.theme.path(toolReleasePath)}'`);
  return { toolConfig, toolReleasePath };
}
