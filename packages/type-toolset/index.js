const { createSelectConfigurablesOption, configureConfigurableSelection } = require("valma");

module.exports = {
  createSelectToolsetCommand,
  createConfigureToolsetCommand,
  createConfigureToolCommand,
  createConfigureToolsetOptions,
  createConfigureToolOptions,
  configureToolsetSelection,
  configureToolSelection,
  createStandardToolsetOption,
  createStatusToolsetCommand,
  createStatusToolCommand,
  createStandardStatusOptions,

};

function createSelectToolsetCommand (vlm, name, simpleName, domain, restrict, restrictToTypeGlob) {
  return vlm.invoke("draft-command", [{
    filename: `configure_${restrict ? `_${restrict}_` : ""}select__${simpleName}.js`,
    export: true,
    skeleton: true,
    brief: `select '${name}'`,
    "exports-vlm": `{ toolset: "${name}" }`,
    describe: `Select '${name}' for the current ${restrict || "workspace"} as a toolset`,

    introduction:
`Edit the introduction for the toolset '${name}' here.
Once this command is transferred to the domain package '${domain}' then
all ${restrict ? `'${restrict}' ` : ""}workspaces that use that domain
can select '${name}' as a toolset via 'vlm select-toolsets'.
This introduction text can be seen during the selection process.
`,

    disabled: restrict && `(yargs) => yargs.vlm.getValOSConfig("type") !== "${restrict}"
    && \`Toolset is restricted to '${restrict}' workspaces\``,

    builder: `(yargs) => yargs.options({})`,
    handler: `async (yargv) => ({
  // Note: this file and the command should be moved to the domain
  // package '${domain}'. Otherwise the toolset will not be visible
  // for vlm select-toolsets.
  devDependencies: { [exports.vlm.toolset]: vlm.domainVersionTag("${domain}") },
  toolsetsUpdate: { [exports.vlm.toolset]: { inUse: true } },
  success: true,
})`,
  }, `.configure/${restrictToTypeGlob}.select/${name}`]);
}

function createConfigureToolCommand (vlm, name, simpleName, brief) {
  return _createConfigureCommand(vlm, "tool", name, simpleName, brief);
}

function createConfigureToolsetCommand (vlm, name, simpleName, brief) {
  return _createConfigureCommand(vlm, "toolset", name, simpleName, brief);
}

function _createConfigureCommand (vlm, configurableKind, name, simpleName, brief) {
  const isTool = (configurableKind === "tool") ? true : ""; // else toolset.
  return vlm.invoke("draft-command", [{
    filename: `configure_${configurableKind}__${simpleName}.js`,
    export: true,
    skeleton: true,
    brief: `configure ${brief || configurableKind}`,
    header: `const { ${!isTool
        ? `createConfigureToolsetOptions, configureToolSelection`
        : `createConfigureToolOptions`} } = require("@valos/type-toolset");\n\n`,
    "exports-vlm": `{ ${configurableKind}: "${name}" }`,
    describe: `Configure the ${configurableKind} '${name}' within the current workspace`,

    introduction: !isTool
        ? `As a toolset this script is automatically called by configure.`
        : `As a tool this script is not automatically called. The parent
toolset or tool which uses this tool must explicit invoke this command.`,

    disabled: !isTool && `(yargs) => !yargs.vlm.getToolsetConfig(yargs.vlm.toolset, "inUse")
    && \`Toolset '\${yargs.vlm.toolset}' not in use\``,

    builder: `(yargs) => yargs.options({
  ...createConfigureTool${isTool ? "" : "set"}Options(yargs.vlm, exports),
})`,
    handler: !isTool
        ? `async (yargv) => {
  const vlm = yargv.vlm;
  const toolsetConfig = vlm.getToolsetConfig(vlm.toolset) || {};
  const toolsetConfigUpdate = {}; // Construct a toolset config update or bail out.
  vlm.updateToolsetConfig(vlm.toolset, toolsetConfigUpdate);
  const selectionResult = await configureToolSelection(
      vlm, vlm.toolset, yargv.reconfigure, yargv.tools);
  return { success: true, ...selectionResult };
}`
        : `async (yargv) => {
  const vlm = yargv.vlm;
  const toolConfig = vlm.getToolConfig(yargv.toolset, vlm.tool) || {};
  const toolConfigUpdate = {}; // Construct a tool config update or bail out.
  vlm.updateToolConfig(yargv.toolset, vlm.tool, toolConfigUpdate);
  return { success: true };
}`,
  }, `.configure/.${configurableKind}/${name}`]);
}

function createConfigureToolsetOptions (vlm, toolsetExports, { toolSelectorName = "tool" } = {}) {
  return {
    ...(toolSelectorName === "tool" ? {
      tools: createSelectConfigurablesOption(
          vlm, "tool", vlm.getToolsetConfig(vlm.toolset, "tools"), `{,.${vlm.toolset}/}.tools/`),
    } : {}),
    reconfigure: {
      alias: "r", type: "boolean",
      description: "Reconfigure all even already configured toolset and tool options.",
    },
  };
}

function createConfigureToolOptions (vlm, toolExports) {
  return {
    toolset: createStandardToolsetOption(vlm, `the toolset for which to ${toolExports.brief}`),
    reconfigure: {
      alias: "r", type: "boolean",
      description: "Reconfigure all even already configured tool options.",
    },
  };
}

function createStatusToolsetCommand (vlm, name, simpleName, commandPath) {
  return createStatusSubCommand(vlm, "toolset", name, simpleName, commandPath);
}

function createStatusToolCommand (vlm, name, simpleName, commandPath) {
  return createStatusSubCommand(vlm, "tool", name, simpleName, commandPath);
}

function createStatusSubCommand (vlm, type, name, simpleName, commandPath) {
  const isTool = (type === "tool") ? true : "";
  return vlm.invoke("draft-command", [{
    filename: `status_${isTool && "tool_"}_${simpleName}.js`,
    brief: `Display ${type} status`,
    export: true,
    header: isTool ? `const { createStandardStatusOptions } = require("@valos/type-toolset");\n`
        : undefined,
    "exports-vlm": `{ ${type}: "${name}" }`,
    describe: !isTool ? `Display the toolset '${name}' status of this workspace`
        : `Display tool '${name}' status of the requested toolset of this workspace`,

    introduction: "",

    disabled: isTool ? undefined :
`(yargs) => !yargs.vlm.getToolsetConfig(yargs.vlm.toolset, "inUse")
    && \`Toolset '\${yargs.vlm.toolset}' not in use\``,

    builder: `(yargs) => yargs.options({
  ...createStandardStatusOptions(yargs.vlm, exports),
})`,
    handler: isTool
        ? _createToolHandlerBody()
        : _createToolsetHandlerBody(),
  }, `.status/${commandPath}${name}`]);
}

function createStandardStatusOptions (vlm, exports) {
  return exports.vlm.tool
      ? {
    toolset: createStandardToolsetOption(vlm, "The toolset of the tool status report"),
  } : {
    "include-tools": {
      type: "boolean", default: true,
      description: "Include tool status report breakdown in results",
    }
  };
}

function createStandardToolsetOption (vlm, description) {
  return {
    type: "string", default: vlm.toolset,
    description,
    interactive: {
      type: "input", when: "if-undefined",
      confirm: value => vlm.confirmToolsetExists(value),
    },
  };
}

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

function configureToolsetSelection (vlm, reconfigure, newSelection, rest) {
  return configureConfigurableSelection(
      vlm, "toolset", reconfigure, newSelection, [], ".toolset/", rest);
}

function configureToolSelection (vlm, toolset, reconfigure, newSelection, rest) {
  return configureConfigurableSelection(
      vlm, "tool", reconfigure, newSelection, [toolset, "tools"], ".tool/", rest);
}
