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
  const commandName = `.configure/${restrictToTypeGlob}${
    yargv.selectable ? ".selectable/" : ""}${vlm.packageConfig.name}`;
  await vlm.invoke("create-command", [{
    filename: `configure__${restrict}${yargv.selectable ? "_selectable_" : "_"}_${simpleName}.js`,
    export: true,
    skeleton: true,
    brief: "toolset configure",
    "exports-vlm": `{ toolset: "${vlm.packageConfig.name}" }`,
    describe: `Configure the toolset '${simpleName}' for the current ${restrict || "repository"}`,

    introduction: restrict
        ? `This script makes the toolset '${simpleName}' selectable by ${restrict} workspaces.`
        : `This script makes the toolset '${simpleName}' selectable by all workspaces.`,

    disabled: `(yargs) => !yargs.vlm.getToolsetConfig(yargs.vlm.toolset, "inUse")
        && \`Toolset '\${yargs.vlm.toolset}' not in use\``,

    builder: `(yargs) => yargs.options({
  reconfigure: {
    alias: "r", type: "boolean",
    description: "Reconfigure '${simpleName}' config of this workspace.",
  },
})`,
    handler: `async (yargv) => {
  const vlm = yargv.vlm;
  return { success: true, devDependencies: { [exports.vlm.toolset]: true };
}`,
  }, commandName]);
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
  return vlm.invoke(`.configure/.type/.toolset/**/*`, { reconfigure: yargv.reconfigure });
};

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
  const { extract, extractee: { ref } } = require("@valos/toolset-vault/vdoc");
  const patchWith = require("@valos/tools/patchWith").default;
  const vlm = yargv.vlm;
  const toolsetConfig = vlm.getToolsetConfig(exports.vlm.toolset);
  const warnings = [];
  const failures = [];
  const target = {};
  for (const [tool/* , toolConfig */] of Object.entries((toolsetConfig || {}).tools || {})) {
    const toolStatuses = await yargv.vlm.invoke(
        \`.status/.tool/\${tool}*\`, [{ toolset: exports.vlm.toolset }]);
    for (const results of [].concat(...(toolStatuses || []))) {
      if (yargv["include-tools"]) patchWith(target, results);
      const toolResult = results[\`status_toolset_\${exports.vlm.toolset}_tools\`][tool];
      if (toolResult.warnings) warnings.push(...toolResult.warnings.map(w => \`\${tool}: \${w}\`));
      if (toolResult.failures) failures.push(...toolResult.failures.map(f => \`\${tool}: \${f}\`));
    }
  }
  const status = !warnings.length && !failures.length ? { success: "OK" }
      : !failures.length ? { warnings }
      : { failures, warnings };
  return extract(
      { "data#status_toolsets": { "${name}": status } },
      { target, omitContext: true });
}`;
  }

  function _createToolHandlerBody () {
    return `async (yargv) => {
  const { extract, extractee: { ref } } = require("@valos/toolset-vault/vdoc");
  const vlm = yargv.vlm;
  const toolConfig = vlm.getToolsetConfig(yargv.toolset, exports.vlm.tool);
  const warnings = [];
  const failures = [];
  // Determine tool warnings and failures
  const status = !warnings.length && !failures.length ? { success: "OK" }
      : !failures.length ? { warnings }
      : { failures, warnings };
  return extract(
      { [\`data#status_toolset_\${yargv.toolset}_tools\`]: {
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
