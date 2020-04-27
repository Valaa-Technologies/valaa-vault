exports.command = ".configure/.select-toolsets";
exports.describe = "Grab and stow toolsets from the set available toolsets";
exports.introduction = `${exports.describe}.

The set of available toolsets in a given package context is defined via
the set of all valma toolset configuration commands at that package
root directory as:

vlm -N '.configure/{,.type/.<type>/,.domain/.<domain>/}.select/**/*'

When a toolset is grabbed to be in use it is always added as a direct
devDependency for the package if it is not already.

After .select-toolsets has been used to grab a subset of the available
toolsets to be in use then any subsequent 'vlm configure' will invoke
the corresponding toolset configuration commands for all toolsets that
are in use.

The simple way to make a toolset available for some package context is
by adding a direct devDependency to the toolset package itself. In
addition there are two ways to source in groups of toolsets:
1. adding a devDependency to a domain package which aggregates
  several toolsets together.
2. packages under a vault sub-directory have access to all the toolsets
  at vault root devDependencies.

Toolsets from file and global pools can be used but should be avoided
as such toolsets are not guaranteed to be always available.`;

exports.disabled = (yargs) => {
  const valos = yargs.vlm.getValOSConfig();
  return !valos ? "No package.json valos stanza found"
      : !valos.type ? "No package.json valos.type stanza found"
      : !valos.domain ? "No package.json valos.domain stanza found"
      : !yargs.vlm.getToolsetsConfig() && "No toolsets.json found";
};
exports.builder = (yargs) => yargs.options({
  toolsets: buildSelectorOption(yargs.vlm, "toolset"),
  reconfigure: {
    alias: "r", type: "boolean",
    description: "Reconfigure all toolsets even if they are already selected or configured.",
  },
});

exports.buildSelectorOption = buildSelectorOption;
function buildSelectorOption (vlm, type) {
  const selectionConfig = (type === "toolset")
      ? vlm.getToolsetsConfig()
      : vlm.getToolsetConfig(vlm.toolset, "tools") || {};
  if (!selectionConfig) throw new Error("toolsets.json missing (maybe run 'vlm init'?)");
  const valos = vlm.packageConfig.valos || vlm.packageConfig.valaa;
  const toolsetGlob = (type !== "tool") ? "" : `{,.${vlm.toolset}/}.tools/`;
  const knownCandidates = vlm
      .listMatchingCommands(
          `.configure/{.domain/.${valos.domain}/,.type/.${valos.type}/,}${toolsetGlob}.select/**/*`)
      .map(name => name.match(/\/.select\/(.*)$/)[1]);
  const configuredNames = Object.keys(selectionConfig || {});
  const inUseSelection = configuredNames
      .filter(name => (selectionConfig[name] || {}).inUse === true);
  const choices = knownCandidates.concat(
          configuredNames.filter(configuredName => !knownCandidates.includes(configuredName)))
      .filter(name => (selectionConfig[name] || {}).inUse !== "always");
  return {
    type: "string", default: inUseSelection, choices,
    interactive: { type: "checkbox", when: choices.length ? "always" : "if-undefined" },
    description: `Select ${type}s to use for the ${
      type === "toolset" ? valos.type : `toolset ${vlm.toolset}`}`,
  };
}

exports.handler = async (yargv) => {
  const vlm = yargv.vlm;
  const toolsetsConfig = vlm.getToolsetsConfig();
  if (!toolsetsConfig) return undefined;
  return _configureSelections(vlm, undefined,
      yargv.reconfigure, yargv.toolsets || [], toolsetsConfig, yargv._);
};

exports.configureToolSelection = configureToolSelection;
function configureToolSelection (yargv, toolsetConfig) {
  return _configureSelections(this, this.toolset, yargv.reconfigure, yargv.tools,
      toolsetConfig.tools || {});
}

async function _configureSelections (
    vlm, toolsetOfTool, reconfigure, newSelection, currentSelectionConfig, rest = []) {
  const { updateResultSideEffects } = require("../configure");
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
    vlm.info(`Stowing ${type}:`, vlm.theme.package(...stowed));
    stowed.forEach(name => { configUpdate[name] = { inUse: false }; });
    ret.stowed = stowed;
  }
  const grabbed = newSelection
      .filter(name => !(currentSelectionConfig[name] || { inUse: false }).inUse);
  if (grabbed.length) {
    vlm.info(`Grabbing ${type}:`, vlm.theme.package(...grabbed));
    grabbed.forEach(name => { configUpdate[name] = { inUse: true }; });
    ret.grabbed = grabbed;
  }
  if (!reconfigure && !grabbed.length && !stowed.length) {
    vlm.info(`No ${type}s to configure: nothing grabbed or stowed and no --reconfigure given`);
    return ret;
  }
  if (!toolsetOfTool) {
    await vlm.updateToolsetsConfig(configUpdate);
  } else {
    await vlm.updateToolsetConfig(toolsetOfTool, { tools: configUpdate });
  }
  const toolsetGlob = toolsetOfTool ? `{,.${toolsetOfTool}/}.tools/` : "";
  ret.selectionConfigures = [];
  for (const grabName of (reconfigure ? newSelection : grabbed)) {
    ret.selectionConfigures.push(...await vlm.invoke(
        `.configure/{.domain/.${valos.domain}/,.type/.${valos.type}/,}${toolsetGlob
          }.select/${grabName}`, rest));
  }
  Object.assign(ret, await updateResultSideEffects(vlm, ...ret.selectionConfigures));
  if (!reconfigure) {
    vlm.info(`Configuring all ${type}s:`);
    // TODO(iridian, 2019-07): should really only configure new selections.
    ret[`${type}Configures`] = await vlm.invoke(
        `.configure/{.domain/.${valos.domain}/,.type/.${valos.type}/,}${
            toolsetGlob || ".toolset/"}**/*`,
        [{ reconfigure: false }, ...rest]);
  } else {
    vlm.info(`Reconfiguring all ${type}s:`);
    ret[`${type}Reconfigures`] = await vlm.invoke(
        `.configure/{.domain/.${valos.domain}/,.type/.${valos.type}/,}${
            toolsetGlob || ".toolset/"}**/*`,
        [{ reconfigure: true }, ...rest]);
  }
  return ret;
}
