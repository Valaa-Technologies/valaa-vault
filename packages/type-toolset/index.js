const {
  updateConfigurableSideEffects,
  createSelectOfMatchingChoicesOption, toSelectorGlob, toRestrictorPath, toSimpleRestrictor,
} = require("valma");

module.exports = {
  draftSelectToolsetCommand,
  draftSelectToolCommand,
  draftConfigureToolsetCommand,
  createConfigureToolCommand,
  draftStatusToolsetCommand,
  createStatusToolCommand,

  checkToolsetSelectorDisabled,
  checkToolSelectorDisabled,
  checkToolsetDisabled,
  checkToolDisabled,

  createSelectToolsetsOption,
  createSelectToolsOption,
  createConfigureToolsetOptions,
  createConfigureToolOptions,
  createStatusToolsetOptions,
  createStatusToolOptions,
  configureToolsetSelection,
  configureToolSelection,
  createToolToolsetOption,
};

function draftSelectToolsetCommand (vlm, name, restriction, draftOptions) {
  return _draftSelectCommand(vlm, "toolset", name, restriction, draftOptions);
}

function draftSelectToolCommand (vlm, name, restriction, draftOptions) {
  return _draftSelectCommand(vlm, "tool", name, restriction, draftOptions);
}

function _draftSelectCommand (vlm, kind, name, restriction, draftOptions) {
  const distributionDomain = vlm.getValOSConfig("domain");
  const simpleName = name.match(/([^/]*)$/)[1];
  const capsKind = `${kind[0].toUpperCase()}${kind.slice(1)}`;
  return vlm.invoke("draft-command", [
    {
      filename: `select_${kind}s${toSimpleRestrictor(restriction)}__${simpleName}.js`,
      export: true,
      template: false,
      confirm: true,
      header:
`const typeToolset = require("@valos/type-toolset");

`,
      "exports-vlm": `{ ${kind}: "${name}" }`,
      brief: `select ${kind} '${name}'`,
      describe: `[Edit single-line description of '${simpleName}' here]`,

      introduction:
`[Edit the introduction for the ${kind} '${name}' here.]

[Once finalized this command should be transferred to the domain
package '${distributionDomain}'. Once transferred then all workspaces
that use that domain can select '${name}' as a toolset via
'vlm configure' given that all selection restriction conditions are
satisfied.]

[This introduction text can be seen during the selection process.]
`,
      disabled:
`(yargs) => typeToolset.check${capsKind}SelectorDisabled(yargs.vlm, exports,
    ${JSON.stringify(restriction)})`,

      builder: `(yargs) => yargs.options({})`,
      handler:
`async (yargv) => ({
  // Note: this file and the command should be moved to the domain
  // package '${distributionDomain}'. Otherwise the toolset will not be visible
  // for vlm select-toolsets.
  devDependencies: { [exports.vlm.toolset]: yargv.vlm.domainVersionTag("${distributionDomain}") },
  toolsetsUpdate: { [exports.vlm.toolset]: { inUse: true } },
  success: true,
})`,
      ...draftOptions,
    },
    `.select/.${kind}s/${toRestrictorPath(restriction)}${name}`,
  ]);
}

function draftConfigureToolsetCommand (vlm, name, restriction, draftOptions) {
  return _draftConfigureCommand(vlm, "toolset", name, restriction, {
    introduction:
`As a toolset this script is automatically called by configure.`,
    handler:
`async (yargv) => {
  const vlm = yargv.vlm;
  const toolsetConfig = vlm.getToolsetConfig(exports.vlm.toolset) || {};
  const toolsetConfigUpdate = { ...toolsetConfig };
  // Construct a toolset config update or exit.
  vlm.updateToolsetConfig(vlm.toolset, toolsetConfigUpdate);
  const selectionResult = await typeToolset.configureToolSelection(
      vlm, vlm.toolset, yargv.reconfigure, yargv.tools);
  return { success: true, ...selectionResult };
}`,
    ...draftOptions,
  });
}

function createConfigureToolCommand (vlm, name, restriction, draftOptions) {
  return _draftConfigureCommand(vlm, "tool", name, restriction, {
    introduction:
`As a tool this script is not automatically called. The parent
toolset or tool which uses this tool must explicit invoke this command.`,
    handler:
`async (yargv) => {
  const vlm = yargv.vlm;
  const toolConfig = vlm.getToolConfig(yargv.toolset, exports.vlm.tool) || {};
  const toolConfigUpdate = { ...toolConfig }; // Construct a tool config update or bail out.
  vlm.updateToolConfig(yargv.toolset, vlm.tool, toolConfigUpdate);
  return { success: true };
}`,
    ...draftOptions,
  });
}

function _draftConfigureCommand (vlm, kind, name, restriction, draftOptions) {
  const simpleName = name.match(/([^/]*)$/)[1];
  const capsKind = `${kind[0].toUpperCase()}${kind.slice(1)}`;
  return vlm.invoke("draft-command", [
    {
      filename: `configure_${kind}s${toSimpleRestrictor(restriction)}__${simpleName}.js`,
      export: true,
      template: false,
      confirm: true,
      header:
`const typeToolset = require("@valos/type-toolset");

`,
      "exports-vlm": `{ ${kind}: "${name}" }`,
      brief: `configure ${kind}`,
      describe: `Configure the ${kind} '${name}' within the current workspace`,

      disabled:
`(yargs) => typeToolset.check${capsKind}Disabled(yargs.vlm, exports)`,

      builder: `(yargs) => yargs.options({
  ...typeToolset.createConfigure${capsKind}Options(yargs.vlm, exports),
})`,
      ...draftOptions,
    },
    `.configure/.${kind}s/${toRestrictorPath(restriction)}${name}`,
  ]);
}

function draftStatusToolsetCommand (vlm, name, restriction, draftOptions) {
  return _draftStatusSubCommand(vlm, "toolset", name, restriction, {
    describe: `Display the toolset '${name}' status of this workspace`,
    handler: _createToolsetStatusHandlerBody(name),
    ...draftOptions,
  });
}

function createStatusToolCommand (vlm, name, restriction, draftOptions) {
  return _draftStatusSubCommand(vlm, "tool", name, restriction, {
    describe: `Display tool '${name}' status of the requested toolset of this workspace`,
    handler: _createToolStatusHandlerBody(name),
    ...draftOptions,
  });
}

function _draftStatusSubCommand (vlm, kind, name, restriction, draftOptions) {
  const simpleName = name.match(/([^/]*)$/)[1];
  const capsKind = `${kind[0].toUpperCase()}${kind.slice(1)}`;
  return vlm.invoke("draft-command", [
    {
      filename: `status_${kind}s${toSimpleRestrictor(restriction)}__${simpleName}.js`,
      export: true,
      confirm: true,
      header:
`const typeToolset = require("@valos/type-toolset");

`,
      "exports-vlm": `{ ${kind}: "${name}" }`,
      brief: `display ${kind} status`,

      introduction: "",

      disabled:
`(yargs) => typeToolset.check${capsKind}Disabled(yargs.vlm, exports)`,

      builder:
`(yargs) => yargs.options({
  ...typeToolset.createStatus${capsKind}Options(yargs.vlm, exports),
})`,
      ...draftOptions,
    },
    `.status/.${kind}s/${toRestrictorPath(restriction)}${name}`,
  ]);
}

function _createToolsetStatusHandlerBody (name) {
    return `async (yargv) => {
  const { extension, extractee: { ref } } = require("@valos/vdoc");
  const patchWith = require("@valos/tools/patchWith").default;
  const vlm = yargv.vlm;
  const toolsetConfig = vlm.getToolsetConfig(exports.vlm.toolset);
  const warnings = [];
  const failures = [];
  const target = {};
  const underscoredToolset = vlm.toolset.replace(/[/@-]/g, "_");
  for (const [tool/* , toolConfig */] of Object.entries((toolsetConfig || {}).tools || {})) {
    const toolStatuses = await yargv.vlm.invoke(
        \`.status/.tools/\${tool}*\`, [{ toolset: vlm.toolset }]);
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

function _createToolStatusHandlerBody (name) {
    return `async (yargv) => {
  const { extension, extractee: { ref } } = require("@valos/vdoc");
  const vlm = yargv.vlm;
  const toolConfig = vlm.getToolConfig(yargv.toolset, exports.vlm.tool);
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

function checkToolsetSelectorDisabled (vlm, { vlm: { toolset } }, restriction) {
  if (!restriction) return false;
  const { domain, type, name } = restriction;
  const selector = vlm.getPackageConfig() || {};
  return domain && ((selector.valos || {}).domain !== domain)
          ? `Toolset '${toolset}' only selectable by domain '${domain}' workspaces`
      : type && ((selector.valos || {}).type !== type)
          ? `Toolset '${toolset}' only selectable by '${type}' workspaces`
      : name && (selector.name !== name)
          ? `Toolset '${toolset}' only selectable by workspace '${name}'`
      : false;
}

function checkToolSelectorDisabled (vlm, { vlm: { tool, toolset } }, restriction) {
  if (!(vlm.toolset || toolset)) return `Tools must have a context-vlm.toolset specified`;
  if (!restriction) return false;
  const { domain, type, name } = restriction;
  const selector = vlm.getToolsetPackageConfig(vlm.toolset || toolset);
  if (!selector) return `Toolset '${vlm.toolset || toolset}' not found for tool '${tool}'`;
  return domain && ((selector.valos || {}).domain !== domain)
          ? `Tool '${tool}' only selectable for domain '${domain}' toolsets`
      : type && ((selector.valos || {}).type !== type)
          ? `Tool '${tool}' only selectable for '${type}' toolsets`
      : name && (selector.name !== name)
          ? `Tool '${tool}' only selectable for toolset '${name}'`
      : false;
}

function checkToolsetDisabled (vlm, toolsetExports) {
  const toolsetName = toolsetExports.vlm.toolset;
  if (!toolsetName) {
    throw new Error(
        `No exports.vlm.toolset defined by the toolset command '${toolsetExports.command}'`);
  }
  const toolsetConfig = vlm.getToolsetConfig(toolsetName);
  if (!toolsetConfig) return `Toolset '${toolsetName}' not selected by the current workspace`;
  if (!toolsetConfig.inUse) {
    return `Toolset '${toolsetName}' selected but not in use in the current workspace`;
  }
  return undefined;
}

function checkToolDisabled (vlm, toolExports) {
  const toolsetName = vlm.toolset;
  if (!toolsetName) return "No vlm.toolset defined in vlm invokation context (use --vlm.toolset)";
  const toolsetConfig = vlm.getToolsetConfig(toolsetName);
  if (!toolsetConfig) return `Toolset '${toolsetName}' not selected by the current workspace`;
  if (!toolsetConfig.inUse) {
    return `Toolset '${toolsetName}' selected but not in use in the current workspace`;
  }
  const toolName = toolExports.vlm.tool;
  if (!toolName) {
    throw new Error(`No exports.vlm.tool defined by the tool command '${toolExports.command}'`);
  }
  const toolConfig = (toolsetConfig.tools || {})[toolName];
  if (!toolConfig) {
    return `Tool '${toolName}' not selected by the current workspace toolset '${toolsetName}'`;
  }
  if (!toolConfig.inUse) {
    return `Tool '${toolName}' selected but not in use in the current workspace toolset '${
        toolsetName}'`;
  }
  return undefined;
}

function createConfigureToolsetOptions (vlm, toolsetExports) {
  return {
    tools: createSelectToolsOption(vlm, toolsetExports),
    reconfigure: {
      alias: "r", type: "boolean",
      description: `Reconfigure all of toolset's '${
          toolsetExports.vlm.toolset}' and its tools' configurations.`,
    },
  };
}

function createConfigureToolOptions (vlm, toolExports) {
  return {
    toolset: createToolToolsetOption(vlm, toolExports.vlm.tool, toolExports.brief),
    reconfigure: {
      alias: "r", type: "boolean",
      description: `Reconfigure all tool '${toolExports.vlm.tool}' configurations.`,
    },
  };
}

function createStatusToolsetOptions (/* vlm, exports */) {
  return {
    "include-tools": {
      type: "boolean", default: true,
      description: "Include tool status report breakdown in results",
    }
  };
}

function createStatusToolOptions (vlm, toolExports) {
  return {
    toolset: createToolToolsetOption(vlm, toolExports.vlm.tool, toolExports.brief),
  };
}

function createSelectToolsetsOption (vlm) {
  return _createSelectToolsOrToolsetsOption(vlm, ".select/.toolsets",
      "toolsets selection",
      `the workspace`,
      vlm.getPackageConfig(),
      vlm.getToolsetsConfig());
}

function createSelectToolsOption (vlm, { vlm: { toolset } }) {
  return _createSelectToolsOrToolsetsOption(vlm, ".select/.tools",
      "tools selection",
      `the toolset '${toolset}'`,
      vlm.getToolsetPackageConfig(toolset),
      vlm.getToolsetConfig(toolset, "tools"));
}

function _createSelectToolsOrToolsetsOption (vlm, primaryGlob,
    choiceBrief, selectorBrief, selectorPackageConfig, selectionConfig = {}, choicesOptions = {}) {
  const configuredNames = Object.keys(selectionConfig);
  if (!selectorPackageConfig) throw new Error(`Selector config not found for ${selectorBrief}`);
  return createSelectOfMatchingChoicesOption(vlm, primaryGlob, selectorPackageConfig, {
    choiceBrief,
    selectorBrief,
    default: Object.entries(selectionConfig)
        .filter(([, { inUse } = {}]) => (inUse === true))
        .map(([key]) => key),
    appendChoices: configuredNames
        .map(configuredName => ({
          name: configuredName,
          value: configuredName,
          description: "<a configured selection which is not otherwise found>",
        })),
    filterChoices: c => ((selectionConfig[c.value] || {}).inUse !== "always"),
    ...choicesOptions,
  });
}

function createToolToolsetOption (vlm, toolName, brief) {
  return {
    type: "string", default: vlm.toolset,
    description: `The toolset for${
        brief ? ` which to ${brief}` : "this operation for"} the tool '${toolName}'`,
    interactive: {
      type: "input", when: "if-undefined",
      confirm: value => vlm.confirmToolsetExists(value),
    },
  };
}

function configureToolsetSelection (vlm, reconfigure, selection, rest) {
  return configureConfigurableSelection(vlm, "toolset", reconfigure, selection,
      "the workspace", vlm.getPackageConfig(), [], rest);
}

function configureToolSelection (vlm, toolset, reconfigure, selection, rest) {
  return configureConfigurableSelection(vlm, "tool", reconfigure, selection,
      `the toolset ${vlm.theme.package(toolset)}`,
      vlm.getToolsetPackageConfig(toolset), [toolset, "tools"], rest);
}

async function configureConfigurableSelection (vlm, kind, reconfigure, selection,
    selectorName, selectorConfig, selectionConfigPath = [], configureArgs = []) {
  const currentSelectionConfig = vlm.getToolsetsConfig(...selectionConfigPath) || {};
  if (!selectorConfig) throw new Error(`Selector config not found for ${selectorName}`);
  const { name, valos: { domain, type } = {} } = selectorConfig;
  const configUpdate = {};
  const ret = { success: true };
  vlm.reconfigure = reconfigure;

  const stowed = Object.keys(currentSelectionConfig)
      .filter(currentName => (!selection.includes(currentName)
          && (currentSelectionConfig[currentName].inUse === true)));
  // TODO: add confirmation for configurations that are about to be eliminated with null
  if (stowed.length) {
    vlm.info(`Stowing ${kind}s from ${selectorName}:`, vlm.theme.package(...stowed));
    stowed.forEach(stowedName => { configUpdate[stowedName] = { inUse: false }; });
    ret.stowed = stowed;
  }
  const newlySelected = selection
      .filter(selectedName => !(currentSelectionConfig[selectedName] || { inUse: false }).inUse);
  if (newlySelected.length) {
    vlm.info(`Selecting new ${kind}s for ${selectorName}:`, vlm.theme.package(...newlySelected));
    newlySelected.forEach(newName => { configUpdate[newName] = { inUse: true }; });
    ret.newlySelected = newlySelected;
  }
  if (newlySelected.length || stowed.length) {
    await vlm.updateToolsetsConfig(selectionConfigPath, configUpdate);
  } else if (!reconfigure) {
    vlm.info(`No ${kind}s to configure for ${selectorName}:`,
        "nothing selected or stowed and no --reconfigure given");
    return ret;
  }
  const kindAndSelectorGlob = `.${kind}s/${toSelectorGlob({ domain, type, name })}`;
  const packages = reconfigure ? selection : newlySelected;
  if (packages.length) {
    const packageFilter = (packages.length === 1) ? packages[0] : `{${packages.join(",")}}`;
    const sideEffects = ret[`${kind}${reconfigure ? "Reselects" : "Selects"}`] = await vlm.invoke(
        `.select/${kindAndSelectorGlob}${packageFilter}`);
    Object.assign(ret, await updateConfigurableSideEffects(vlm, ...sideEffects));

    vlm.info(
        !reconfigure
            ? `Configuring the newly selected ${kind}s in ${selectorName}:`
            : `Reconfiguring all selectable ${kind}s in ${selectorName}:`,
        vlm.theme.package(...packages));
    ret[`${kind}${reconfigure ? "Reconfigures" : "Configures"}`] = await vlm.invoke(
        `.configure/${kindAndSelectorGlob}${packageFilter}`,
        [{ reconfigure: false }, ...configureArgs]);
  }
  return ret;
}
