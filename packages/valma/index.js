module.exports = {
  createConfigureToolsetOptions,
  createConfigureToolOptions,
  createStandardToolsetOption,
  createSelectionOption,
  listMatchingConfigurableChoices,
  inquireConfigurableName,
  configureToolsetSelections,
  configureToolSelection,
  updateConfigureSideEffects,
};

// TODO(iridian, 2020-05): tool and toolset function should be moved to
// @valos/type-toolset. However annoyingly enough, valma is quite
// intertwined with this concept so proper separation would necessitate
// dependency inversion and that's a bit too much abstraction for my
// taste.
// These function can are forward-exported by @valos/type-toolset
// however and all auto-generated valma commands import them by that name.
function createConfigureToolsetOptions (vlm, toolsetExports, { toolSelectorName = "tool" } = {}) {
  return {
    ...(!toolSelectorName ? {} : {
      tools: createSelectionOption(vlm, toolSelectorName),
    }),
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

function createSelectionOption (vlm, type) {
  const selectionConfig = (type === "toolset")
      ? vlm.getToolsetsConfig()
      : vlm.getToolsetConfig(vlm.toolset, "tools") || {};
  if (!selectionConfig) throw new Error("toolsets.json missing (maybe run 'vlm init'?)");
  const valos = vlm.packageConfig.valos || vlm.packageConfig.valaa;
  const configuredNames = Object.keys(selectionConfig || {});
  const inUseSelection = configuredNames
      .filter(name => (selectionConfig[name] || {}).inUse === true);
  return {
    type: "string", default: inUseSelection,
    interactive: async () => {
      const toolsetGlob = (type !== "tool") ? "" : `{,.${vlm.toolset}/}.tools/`;
      let choices = await listMatchingConfigurableChoices(
          vlm, `{.domain/.${valos.domain}/,.type/.${valos.type}/,}${toolsetGlob}.select/**/*`,
          ".*\\.select/");
      choices.push(...configuredNames
          .filter(configuredName => !choices.find(c => (c.name === configuredName)))
          .map(name => ({
            name, value: name, description: "has an existing toolset configuration",
          })));
      choices = choices.filter(c => (selectionConfig[c.value] || {}).inUse !== "always");
      return { type: "checkbox", choices, when: choices.length ? "always" : "if-undefined" };
    },
    description: `Select ${type}s to use for the ${
      type === "toolset" ? valos.type : `toolset ${vlm.toolset}`}`,
  };
}

async function listMatchingConfigurableChoices (
    vlm, configurableGlob, namePrefixRegExpToExclude = "[^/]+/", nameSuffixRegExpToExclude = "") {
  const results = await vlm.invoke(
      `.configure/${configurableGlob}`,
      ["--show-name", "--show-description"], { "enable-disabled": true });
  return results.map(entry => {
    const commandName = Object.keys(entry).find(k => k !== "...");
    if (!commandName) return undefined;
    const name = commandName.match(
        new RegExp(`^.configure/${namePrefixRegExpToExclude}(.*)${nameSuffixRegExpToExclude}$`))[1];
    return !name ? undefined : { name, value: name, description: entry[commandName].description };
  }).filter(n => n);
}

async function inquireConfigurableName (vlm, category, prompt, selection, answers, answerKey) {
  if (selection === "<none>") {
    answers[answerKey] = undefined;
  } else if (selection[0] === "<") {
    answers[answerKey] = await vlm.inquireText(`Enter ${prompt}:`);
  } else {
    vlm.speak(await vlm.invoke(
      `.configure/.${category}/${answers[answerKey]}`, ["--show-introduction"]));
  }
  return vlm.inquireConfirm(`Confirm ${prompt} selection: '${answers[answerKey]}'?`);
}

function configureToolsetSelections (vlm, reconfigure, newToolsetsSelection, toolsetConfig, rest) {
  return _configureSelections(vlm, null, reconfigure, newToolsetsSelection, toolsetConfig, rest);
}

function configureToolSelection (vlm, toolset, reconfigure, newToolSelection, toolsConfig, rest) {
  return _configureSelections(vlm, toolset, reconfigure, newToolSelection, toolsConfig, rest);
}

async function _configureSelections (
    vlm, toolsetOfTool, reconfigure, newSelection, currentSelectionConfig = {}, rest = []) {
  const type = toolsetOfTool ? "tool" : "toolset";
  const valos = vlm.packageConfig.valos || vlm.packageConfig.valaa;
  const configUpdate = {};
  const ret = { success: true };
  vlm.reconfigure = reconfigure;

  const stowed = Object.keys(currentSelectionConfig)
      .filter(name => (!newSelection.includes(name)
          && (currentSelectionConfig[name].inUse === true)));
  // TODO: add confirmation for configurations that are about to be eliminated with null
  if (stowed.length) {
    vlm.info(`Stowing ${type}s:`, vlm.theme.package(...stowed));
    stowed.forEach(name => { configUpdate[name] = { inUse: false }; });
    ret.stowed = stowed;
  }
  const selected = newSelection
      .filter(name => !(currentSelectionConfig[name] || { inUse: false }).inUse);
  if (selected.length) {
    vlm.info(`Selecting ${type}s:`, vlm.theme.package(...selected));
    selected.forEach(name => { configUpdate[name] = { inUse: true }; });
    ret.selected = selected;
  } else if (!reconfigure && !stowed.length) {
    vlm.info(`No ${type}s to configure: nothing selected or stowed and no --reconfigure given`);
    return ret;
  }
  if (!toolsetOfTool) {
    await vlm.updateToolsetsConfig(configUpdate);
  } else {
    await vlm.updateToolsetConfig(toolsetOfTool, { tools: configUpdate });
  }
  const toolsetGlob = toolsetOfTool ? `{,.${toolsetOfTool}/}.tools/` : "";
  let packageFilter = `{${selected.join(",")},}`;
  if (selected.length) {
    const sideEffects = ret[`${type}${reconfigure ? "Reselects" : "Selects"}`] = await vlm.invoke(
        `.configure/{.domain/.${valos.domain}/,.type/.${valos.type}/,}${toolsetGlob
          }.select/${packageFilter}`,
        rest);
    Object.assign(ret, await updateConfigureSideEffects(vlm, sideEffects));
  }
  if (!reconfigure) {
    vlm.info(`Configuring the new ${type} selections:`);
  } else {
    vlm.info(`Reconfiguring all ${type}s:`);
    packageFilter = "**/*";
  }
  ret[`${type}Configures`] = await vlm.invoke(
      `.configure/{.domain/.${valos.domain}/,.type/.${valos.type}/,}${
          toolsetGlob || ".toolset/"}${packageFilter}`,
      [{ reconfigure: false }, ...rest]);
  return ret;
}

async function updateConfigureSideEffects (vlm, ...results) {
  const resultBreakdown = {};

  const devDependencies = Object.assign({}, ...results.map(r => (r || {}).devDependencies || {}));
  const newDevDependencies = await vlm.addNewDevDependencies(devDependencies);
  if (newDevDependencies) resultBreakdown.newDevDependencies = newDevDependencies;

  results.forEach(r => (r || {}).toolsetsUpdate && vlm.updateToolsetsConfig(r.toolsetsUpdate));
  resultBreakdown.success = results.reduce((a, r) => a && ((r || {}).success !== false), true);
  return resultBreakdown;
}
