module.exports = {
  createStandardBuildTargetOption (yargs, description) {
    return {
      type: "string", default: yargs.vlm.releasePath,
      description,
      interactive: { type: "input", when: "if-undefined" },
    };
  },

  createStandardDeploySourceOption (yargs, description) {
    return {
      type: "string", default: yargs.vlm.releasePath,
      description,
      interactive: {
        type: "input", when: "if-undefined", confirm: value => !!yargs.vlm.shell.test("-d", value),
      },
    };
  },

  /**
   * Validates toolset build pre-conditions and returns the toolset target dist path where the
   * actual build will be placed.
   *
   * @param {*} toolsetName
   * @param {*} releasePath
   * @returns
   */
  prepareToolsetBuild (yargv, toolsetName, toolsetDescription = "toolset",
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
  },

  prepareToolBuild (yargv, toolsetName, toolName,
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
  },

  locateToolsetRelease (yargv, toolsetName, toolsetDescription = "toolset") {
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
  },

  locateToolRelease (yargv, toolsetName, toolName, toolDescription = "tool") {
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
  },
};
