exports.command = ".configure/.type/toolset";
exports.describe = "Initialize toolset workspace";
exports.introduction = `${exports.describe}.

A valma toolset is a package which provides various resources for
a depending workspace with the ability to have workspace specific
configurations in their 'toolsets.json'.
These resources might be new valma commands, file templates,
dependencies to other valma toolsets and tools, to external tools or
to plain javascript libraries; anything that can be expressed in a
package really.

The defining quality of a toolset is its ability to have workspace
specific configuration which all toolset commands and even other
javascript files can access to customize their behaviour. Additionally
toolsets appear in configuration listings and can be selectively
enabled or disabled on a workspace.

A valma toolsets are added as regular devDependencies and configured
by running 'vlm configure' afterwards.`;

exports.disabled = (yargs) => (yargs.vlm.getValOSConfig("type") !== "toolset")
    && `Workspace is not a 'toolset' (is '${yargs.vlm.getValOSConfig("type")}')`;
exports.builder = (yargs) => {
  const vlm = yargs.vlm;
  const typeChoices = vlm.listMatchingCommands(".configure/.type/{,*/**/}*")
      .map(n => n.match(/^.configure\/.type\/(@[^/@]*\/[^/@]*|[^/@]*)/)[1])
      .filter(n => n)
      .concat("<custom>");
  typeChoices.unshift("<none>");
  return yargs.options({
    reconfigure: {
      alias: "r", type: "boolean",
      description: "Reconfigure all 'toolset' configurations of this workspace.",
    },
    restrict: {
      type: "string", choices: typeChoices,
      description: `Restrict this toolset to a particular valos type (clear for no restriction):`,
      interactive: {
        type: "list", when: vlm.reconfigure ? "always" : "if-undefined", pageSize: 10,
        confirm: _inquireIfCustomThenAlwaysConfirm.bind(null, vlm, "restrict"),
      },
    },
    selectable: {
      type: "any", default: true,
      description: `Make this toolset grabbable and stowable (falsy for always-on):`,
      interactive: { type: "confirm", when: "if-undefined" },
    },
    brief: {
      type: "string",
      description: "A brief two-three word description of this toolset",
    },
  });
};

async function _inquireIfCustomThenAlwaysConfirm (vlm, category, selection, answers) {
  if (selection === "<custom>") {
    answers[category] = await vlm.inquireText(`Enter custom valos.type:`);
  } else if (selection === "<none>") {
    answers[category] = undefined;
  } else {
    vlm.speak(await vlm.invoke(
      `.configure/.type/${answers[category]}`, ["--show-introduction"]));
  }
  return vlm.inquireConfirm(`Confirm restrict valos.type selection: '${answers[category]}'?`);
}

exports.handler = async (yargv) => {
  const vlm = yargv.vlm;
  const simpleName = vlm.packageConfig.name.match(/([^/]*)$/)[1];
  const restrict = (yargv.restrict && (yargv.restrict !== "<none>") && yargv.restrict) || "";
  const restrictToTypeGlob = yargv.restrict ? `.type/.${yargv.restrict}/` : "";
  await createConfigureCommand(vlm, "toolset", vlm.packageConfig.name, simpleName, yargv.brief);
  if (yargv.selectable) {
    await createSelectToolsetCommand(
        vlm, vlm.packageConfig.name, simpleName, restrict, restrictToTypeGlob);
  }
  if (await vlm.inquireConfirm("Create toolset status sub-command skeleton?")) {
    await createStatusSubCommand(vlm, "toolset", vlm.packageConfig.name,
        `${restrict ? `${restrict}_` : ""}_toolset__${simpleName}`,
        `${restrictToTypeGlob}40-toolsets/`);
  }
  if ((yargv.restrict === "opspace") && await vlm.inquireConfirm(
      "Create opspace toolset (build|deploy)-release sub-command skeletons?")) {
    await createReleaseSubCommand(vlm, "toolset", vlm.packageConfig.name, simpleName, "build");
    await createReleaseSubCommand(vlm, "toolset", vlm.packageConfig.name, simpleName, "deploy");
  }
  return { success: true };
};

exports.createConfigureCommand = createConfigureCommand;
function createConfigureCommand (vlm, type, name, simpleName, brief) {
  const isTool = (type === "tool") ? true : ""; // else toolset.
  return vlm.invoke("create-command", [{
    filename: `configure_${type}__${simpleName}.js`,
    export: true,
    skeleton: true,
    brief: `configure ${brief || type}`,
    "exports-vlm": `{ ${type}: "${name}" }`,
    describe: `Configure the ${type} '${simpleName}' within the current workspace`,

    introduction: !isTool
        ? `As a toolset this script is automatically called by configure.`
        : `As a tool this script is not automatically called. The parent
toolset or tool which uses this tool must explicit invoke this command.`,

    disabled: !isTool && `(yargs) => !yargs.vlm.getToolsetConfig(yargs.vlm.toolset, "inUse")
    && \`Toolset '\${yargs.vlm.toolset}' not in use\``,

    builder: `(yargs) => yargs.options({
  ...yargs.vlm.createConfigureTool${isTool ? "" : "set"}Options(exports),
})`,
    handler: !isTool
        ? `async (yargv) => {
  const vlm = yargv.vlm;
  const toolsetConfig = vlm.getToolsetConfig(vlm.toolset) || {};
  const toolsetConfigUpdate = {}; // Construct a toolset config update or bail out.
  vlm.updateToolsetConfig(vlm.toolset, toolsetConfigUpdate);
  const selectionResult = await vlm.configureToolSelection(yargv, toolsetConfig);
  return { success: true, ...selectionResult };
}`
        : `async (yargv) => {
  const vlm = yargv.vlm;
  const toolConfig = vlm.getToolConfig(yargv.toolset, vlm.tool) || {};
  const toolConfigUpdate = {}; // Construct a tool config update or bail out.
  vlm.updateToolConfig(yargv.toolset, vlm.tool, toolConfigUpdate);
  return { success: true };
}`,
  }, `.configure/.${type}/${name}`]);
}

exports.createSelectToolsetCommand = createSelectToolsetCommand;
function createSelectToolsetCommand (vlm, name, simpleName, restrict, restrictToTypeGlob) {
  return vlm.invoke("create-command", [{
    filename: `configure_${restrict ? `_${restrict}_` : ""}select__${simpleName}.js`,
    export: true,
    skeleton: true,
    brief: "select toolset",
    "exports-vlm": `{ toolset: "${name}" }`,
    describe: `Select the toolset '${simpleName}' for the current ${restrict || "workspace"}`,

    introduction: `This script makes the toolset '${simpleName}' selectable by ${
      restrict || "all"} workspaces.`,

    disabled: restrict && `(yargs) => yargs.vlm.getValOSConfig("type") !== "${restrict}"
    && \`Toolset is restricted to '${restrict}' workspaces\``,

    builder: `(yargs) => yargs.options({})`,
    handler: `async (yargv) => {
  // Note: this file and the command should be moved to the workshop of
  // this domain. Otherwise the toolset will not be visible in
  // vlm select-toolsets.
  const vlm = yargv.vlm;
  vlm.updateToolsetConfig(vlm.toolset, { inUse: true });
  return { success: true, devDependencies: { [exports.vlm.toolset]: true } };
}`,
  }, `.configure/${restrictToTypeGlob}.select/${name}`]);
}

exports.createStatusSubCommand = createStatusSubCommand;
function createStatusSubCommand (vlm, type, name, simpleName, commandPath) {
  const isTool = (type === "tool") ? true : "";
  return vlm.invoke("create-command", [{
    filename: `status_${isTool && "tool_"}_${simpleName}.js`,
    brief: `Display ${type} status`,
    export: true,
    "exports-vlm": `{ ${type}: "${name}" }`,
    describe: !isTool ? `Display the toolset '${name}' status of this workspace`
        : `Display the tool '${name}' status of this workspace and given toolset`,

    introduction: "",

    disabled: isTool ? undefined :
`(yargs) => !yargs.vlm.getToolsetConfig(yargs.vlm.toolset, "inUse")
    && \`Toolset '\${yargs.vlm.toolset}' not in use\``,

    builder: `(yargs) => yargs.options({${isTool ? `
  toolset: yargs.vlm.createStandardToolsetOption("The toolset of the tool status report"),` : `
  "include-tools": {
    type: "boolean", default: true,
    description: "Include tool status report breakdown in results",
  },`}
})`,
    handler: !isTool ? _createToolsetHandlerBody() : _createToolHandlerBody(),
  }, `.status/${commandPath}${name}`]);

  function _createToolsetHandlerBody () {
    return `async (yargv) => {
  const { extension, extractee: { ref } } = require("@valos/vdoc");
  const patchWith = require("@valos/tools/patchWith").default;
  const vlm = yargv.vlm;
  const toolsetConfig = vlm.getToolsetConfig(vlm.toolset);
  const warnings = [];
  const failures = [];
  const target = {};
  const underscoredToolset = vlm.toolset.replace(/[/@-]/g, "_");
  for (const [tool/* , toolConfig */] of Object.entries((toolsetConfig || {}).tools || {})) {
    const toolStatuses = await yargv.vlm.invoke(
        \`.status/.tool/\${tool}*\`, [{ toolset: vlm.toolset }]);
    for (const results of [].concat(...(toolStatuses || []))) {
      if (yargv["include-tools"]) patchWith(target, results);
      const toolResult = results[\`status_toolset_\${underscoredToolset}_tools\`][tool];
      if (toolResult.warnings) warnings.push(...toolResult.warnings.map(w => \`\${tool}: \${w}\`));
      if (toolResult.failures) failures.push(...toolResult.failures.map(f => \`\${tool}: \${f}\`));
    }
  }
  const status = !warnings.length && !failures.length ? { success: "OK" }
      : !failures.length ? { warnings }
      : { failures, warnings };
  return extension.extract(
      { "data#status_toolsets": { "${name}": status } },
      { target, omitContext: true });
}`;
  }

  function _createToolHandlerBody () {
    return `async (yargv) => {
  const { extension, extractee: { ref } } = require("@valos/vdoc");
  const vlm = yargv.vlm;
  const toolConfig = vlm.getToolsetConfig(yargv.toolset, exports.vlm.tool);
  const warnings = [];
  const failures = [];
  // Determine tool warnings and failures
  const status = !warnings.length && !failures.length ? { success: "OK" }
      : !failures.length ? { warnings }
      : { failures, warnings };
  return extension.extract(
      { [\`data#status_toolset_\${yargv.toolset.replace(/[/@-]/g, "_")}_tools\`]: {
        "${name}": status,
      } },
      { omitContext: true });
}`;
  }
}

exports.createReleaseSubCommand = createReleaseSubCommand;
function createReleaseSubCommand (vlm, type, name, simpleName, subName) {
  const isTool = (type === "tool") ? true : "";
  const isBuild = (subName === "build");
  return vlm.invoke("create-command", [{
    filename: `release-${subName}_${isTool && "tool_"}_${simpleName}.js`,
    brief: `${isBuild ? "Build" : "Deploy"} a sub-release`,
    export: true,
    header: `const opspace = require("@valos/type-opspace");\n\n`,
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
`(yargs) => !yargs.vlm.getToolsetConfig(yargs.vlm.toolset, "inUse")
    && \`Toolset '\${yargs.vlm.toolset}' not in use\``,

    builder:
`(yargs) => yargs.options({${
    isTool && `
  toolset: yargs.vlm.createStandardToolsetOption(
      "The containing toolset of this tool release ${subName}"),`
}${!isBuild ? `
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
  const ${type}Version = yargv.overwrite ? undefined
      : await vlm.invoke(exports.command, ["--version"]);
  const { ${type}Config, ${type}ReleasePath } = opspace.prepareTool${isTool ? "" : "set"}Build(
      yargv, ${isTool && "toolset, "}vlm.${type}, "${simpleName}", ${type}Version);
  if (!${type}Config) return { success: false };

  vlm.shell.ShellString(${type}Version).to(vlm.path.join(${type}ReleasePath, "version-hash"));
  return { success: true, ${type}ReleasePath, ${type}Version };
}`
      :
`async (yargv) => {
  const vlm = yargv.vlm;${isTool && `
  const toolset = yargv.toolset;`}
  const { ${type}Config, ${type}ReleasePath } = opspace.locateTool${isTool ? "" : "set"}Release(
      yargv, ${isTool && "toolset, "}vlm.${type}, "${simpleName}");
  if (!${type}ReleasePath) return { success: false };

  const deployedReleaseHash = await vlm.readFile(
      vlm.path.join(${type}ReleasePath, "version-hash"));

  ${isTool
    ? "vlm.updateToolConfig(toolset, vlm.tool, { deployedReleaseHash });"
    : "vlm.updateToolsetConfig(vlm.toolset, { deployedReleaseHash });"
  }
  return { success: true, ${type}ReleasePath, deployedReleaseHash };
}`,
  }, `.release-${subName}/${isTool ? ".tool/" : ""}${name}`]);
}
