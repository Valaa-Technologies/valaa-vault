module.exports = {
  createSelectConfigurablesOption,
  listMatchingConfigurableChoices,
  inquireConfigurableName,
  configureConfigurableSelection,
  updateConfigurableSideEffects,
};

function createSelectConfigurablesOption (
    vlm, configurableKind, selectionConfig = {}, configurableGlob = "") {
  const valos = vlm.packageConfig.valos || vlm.packageConfig.valaa;
  const configuredNames = Object.keys(selectionConfig || {});
  const inUseSelection = configuredNames
      .filter(name => (selectionConfig[name] || {}).inUse === true);
  return {
    type: "string", default: inUseSelection,
    interactive: async () => {
      let choices = await listMatchingConfigurableChoices(
          vlm, "select", `{.domain/.${valos.domain}/,.type/.${valos.type}/,}${configurableGlob}`);
      choices.push(...configuredNames
          .filter(configuredName => !choices.find(c => (c.name === configuredName)))
          .map(name => ({
            name, value: name, description: "has an existing toolset configuration",
          })));
      choices = choices.filter(c => (selectionConfig[c.value] || {}).inUse !== "always");
      return { type: "checkbox", choices, when: choices.length ? "always" : "if-undefined" };
    },
    description: `Select ${configurableKind}s to use for '${vlm.toolset || valos.type}'`,
  };
}

async function listMatchingConfigurableChoices (
    vlm, configurableKind, invokeGlobInfix = "", nameSuffixRegExpToExclude = "") {
  const results = await vlm.invoke(`.configure/${invokeGlobInfix}.${configurableKind}/**/*`,
      ["--show-name", "--show-description"], { "enable-disabled": true });
  return results.map(entry => {
    const commandName = Object.keys(entry).find(k => k !== "...");
    if (!commandName) return undefined;
    const nameRegExp = `^\\.configure.*/\\.${configurableKind}/(.*)${nameSuffixRegExpToExclude}$`;
    const name = (commandName.match(new RegExp(nameRegExp)) || [])[1];
    if (name === undefined) {
      throw new Error(`Could not match configurable name from command name "${
          commandName}" using matcher "${nameRegExp}"`);
    }
    return !name ? undefined : { name, value: name, description: entry[commandName].description };
  }).filter(n => n);
}

async function inquireConfigurableName (
    vlm, configurableKind, prompt, selection, answers, answerKey) {
  if (selection === "<none>") {
    answers[answerKey] = undefined;
  } else if (selection[0] === "<") {
    answers[answerKey] = await vlm.inquireText(`Enter ${prompt}:`);
  } else {
    vlm.speak(await vlm.invoke(
      `.configure/.${configurableKind}/${answers[answerKey]}`, ["--show-introduction"]));
  }
  return vlm.inquireConfirm(`Confirm ${prompt} selection: '${answers[answerKey]}'?`);
}

async function configureConfigurableSelection (
    vlm, configurableKind, reconfigure, newSelection, selectionConfigPath = [],
    configureGlob, configureArgs = []) {
  const currentSelectionConfig = vlm.getToolsetsConfig(...selectionConfigPath) || {};

  const valos = vlm.packageConfig.valos;
  const configUpdate = {};
  const ret = { success: true };
  vlm.reconfigure = reconfigure;

  const stowed = Object.keys(currentSelectionConfig)
      .filter(name => (!newSelection.includes(name)
          && (currentSelectionConfig[name].inUse === true)));
  // TODO: add confirmation for configurations that are about to be eliminated with null
  if (stowed.length) {
    vlm.info(`Stowing ${configurableKind}s:`, vlm.theme.package(...stowed));
    stowed.forEach(name => { configUpdate[name] = { inUse: false }; });
    ret.stowed = stowed;
  }
  const selected = newSelection
      .filter(name => !(currentSelectionConfig[name] || { inUse: false }).inUse);
  if (selected.length) {
    vlm.info(`Selecting ${configurableKind}s:`, vlm.theme.package(...selected));
    selected.forEach(name => { configUpdate[name] = { inUse: true }; });
    ret.selected = selected;
  }
  if (!reconfigure && !selected.length && !stowed.length) {
    vlm.info(`No ${
        configurableKind}s to configure: nothing selected or stowed and no --reconfigure given`);
    return ret;
  }
  await vlm.updateToolsetsConfig(selectionConfigPath, configUpdate);
  const configurableGlob = selectionConfigPath.length
      ? `{,.${selectionConfigPath.join("/.")}/` : "";
  let packageFilter = `{${selected.join(",")},}`;
  if (selected.length) {
    const sideEffects = ret[`${configurableKind}${reconfigure ? "Reselects" : "Selects"}`] =
        await vlm.invoke(`.configure/{.domain/.${valos.domain}/,.type/.${valos.type}/,}${
            configurableGlob}.select/${packageFilter}`);
    Object.assign(ret, await updateConfigurableSideEffects(vlm, ...sideEffects));
  }
  if (!reconfigure) {
    vlm.info(`Configuring the new ${configurableKind} selections:`);
  } else {
    vlm.info(`Reconfiguring all ${configurableKind}s:`);
    packageFilter = "**/*";
  }
  ret[`${configurableKind}Configures`] = await vlm.invoke(
      `.configure/{.domain/.${valos.domain}/,.type/.${valos.type}/,}${
          configureGlob}${packageFilter}`,
      [{ reconfigure: false }, ...configureArgs]);
  return ret;
}

async function updateConfigurableSideEffects (vlm, ...results) {
  const resultBreakdown = {};

  const devDependencies = Object.assign({}, ...results.map(r => (r || {}).devDependencies || {}));
  const newDevDependencies = await vlm.addNewDevDependencies(devDependencies);
  if (newDevDependencies) resultBreakdown.newDevDependencies = newDevDependencies;

  results.forEach(r => (r || {}).toolsetsUpdate && vlm.updateToolsetsConfig(r.toolsetsUpdate));
  resultBreakdown.success = results.reduce((a, r) => a && ((r || {}).success !== false), true);
  return resultBreakdown;
}
