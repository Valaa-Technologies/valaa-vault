const { createStandardToolsetOption, createReleaseToolOptions } = require("@valos/type-toolset");

module.exports = {
  createReleaseToolsetCommand,
  createReleaseToolCommand,
  createStandardBuildOptions,
  createStandardDeployOptions,
  prepareToolsetBuild,
  prepareToolBuild,
  locateToolsetRelease,
  locateToolRelease,
};

function createReleaseToolsetCommand (vlm, name, simpleName, subName) {
  return _createReleaseSubCommand(vlm, "toolset", name, simpleName, subName);
}

function createReleaseToolCommand (vlm, name, simpleName, subName) {
  return _createReleaseSubCommand(vlm, "tool", name, simpleName, subName);
}

function _createReleaseSubCommand (vlm, category, name, simpleName, subName) {
  const isTool = (category === "tool") ? true : "";
  const isBuild = (subName === "build");
  return vlm.invoke("draft-command", [{
    filename: `release-${subName}_${isTool && "tool_"}_${simpleName}.js`,
    brief: `${isBuild ? "Build" : "Deploy"} a sub-release`,
    export: true,
    header: `const opspace = require("@valos/type-opspace");\n`,
    "exports-vlm": `{ ${category}: "${name}" }`,
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
`(yargs) => !yargs.vlm.getToolsetConfig(yargs.vlm.toolset, "inUse")
    && \`Toolset '\${yargs.vlm.toolset}' not in use\``,

    builder:
`(yargs) => yargs.options({
  ...opspace.createStandard${isBuild ? "Build" : "Deploy"}Options(yargs.vlm, exports),
})`,

    handler: isBuild
        ?
`async (yargv) => {
  const vlm = yargv.vlm;${isTool && `
  const toolset = yargv.toolset;`}
  const ${category}Version = yargv.overwrite ? undefined
      : await vlm.invoke(exports.command, ["--version"]);
  const { ${category}Config, ${category}ReleasePath } = opspace.prepareTool${
      isTool ? "" : "set"}Build(yargv, ${isTool && "toolset, "}vlm.${category}, "${
      simpleName}", ${category}Version);
  if (!${category}Config) return { success: false };

  vlm.shell.ShellString(${category}Version).to(vlm.path.join(${
      category}ReleasePath, "version-hash"));
  return { success: true, ${category}ReleasePath, ${category}Version };
}`
      :
`async (yargv) => {
  const vlm = yargv.vlm;${isTool && `
  const toolset = yargv.toolset;`}
  const { ${category}Config, ${category}ReleasePath } = opspace.locateTool${
      isTool ? "" : "set"}Release(yargv, ${isTool && "toolset, "}vlm.${category}, "${simpleName}");
  if (!${category}ReleasePath) return { success: false };

  const deployedReleaseHash = await vlm.readFile(
      vlm.path.join(${category}ReleasePath, "version-hash"));

  ${isTool
    ? "vlm.updateToolConfig(toolset, vlm.tool, { deployedReleaseHash });"
    : "vlm.updateToolsetConfig(vlm.toolset, { deployedReleaseHash });"
  }
  return { success: true, ${category}ReleasePath, deployedReleaseHash };
}`,
  }, `.release-${subName}/${isTool ? ".tool/" : ""}${name}`]);
}

function createStandardBuildOptions (vlm, exports) {
  return {
    ...createReleaseToolOptions(vlm, exports),
    ...(!vlm.tool ? {} : {
      toolset: createStandardToolsetOption(vlm, "The parent toolset of this tool build"),
    }),
    target: {
      type: "string", default: vlm.releasePath,
      description: "The target root release path of the whole build",
      interactive: { type: "input", when: "if-undefined" },
    },
    force: { alias: "f", type: "boolean", description: "Allow building already deployed releases" },
    overwrite: { type: "boolean", description: "Allow overwriting existing local build files" },
  };
}

function createStandardDeployOptions (vlm, exports) {
  return {
    ...createReleaseToolOptions(vlm, exports),
    source: {
      type: "string", default: vlm.releasePath,
      description: "The source root release path of the whole deployment",
      interactive: {
        type: "input", when: "if-undefined", confirm: value => !!vlm.shell.test("-d", value),
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
