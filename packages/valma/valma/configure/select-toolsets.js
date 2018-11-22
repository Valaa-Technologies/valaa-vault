exports.command = ".configure/.select-toolsets";
exports.describe = "Grab and stow toolsets from the set available toolsets";
exports.introduction = `${exports.describe}.

The set of available toolsets is defined by the set of all valma
'toolset configure' commands listed by the invokation (note the empty
  selector):

vlm -da '.configure/{,.type/.<type>/,.domain/.<domain>/}.toolset/**/*'

An invokation 'vlm configure' will invoke these toolset configure
command for all toolsets that are selected to be in use.

Toolsets are usually sourced via depending on workshop packages.
Toolsets from file and global pools can be used but should be avoided
as such toolsets are not guaranteed to be always available.`;

exports.disabled = (yargs) => {
  const valaa = yargs.vlm.getPackageConfig("valaa");
  return !valaa || !valaa.type || !valaa.domain || !yargs.vlm.getToolsetsConfig();
};
exports.builder = (yargs) => {
  const toolsetsConfig = yargs.vlm.getToolsetsConfig();
  if (!toolsetsConfig) throw new Error("toolsets.json missing (maybe run 'vlm init'?)");
  if (this.disabled(yargs)) throw new Error("package.json missing stanza .valaa.type/.domain");
  const valaa = yargs.vlm.packageConfig.valaa;
  const knownToolsets = yargs.vlm
      .listMatchingCommands(
          `.configure/{,.type/.${valaa.type}/,.domain/.${valaa.domain}/}.toolset/**/*`)
      .map(name => name.match(/\/.toolset\/(.*)$/)[1]);
  const configuredToolsets = Object.keys(toolsetsConfig || {});
  const usedToolsets = configuredToolsets
      .filter(name => (toolsetsConfig[name] || {}).inUse);
  const allToolsets = knownToolsets.concat(
      configuredToolsets.filter(toolset => !knownToolsets.includes(toolset)));
  return yargs.options({
    reconfigure: {
      alias: "r", type: "boolean",
      description: "Reconfigure all vault type configurations",
    },
    toolsets: {
      type: "string", default: usedToolsets, choices: allToolsets,
      interactive: { type: "checkbox", when: "always" },
      description:
          "Grab toolsets to use from the available toolsets (check to grab, uncheck to stow)",
    },
  });
};

exports.handler = async (yargv) => {
  const vlm = yargv.vlm;
  const toolsetsConfig = vlm.getToolsetsConfig();
  if (!toolsetsConfig) return undefined;

  const newToolsets = yargv.toolsets || [];
  const toolsets = {};
  const ret = {};

  const stowToolsets = Object.keys(toolsetsConfig)
      .filter(name => (!newToolsets.includes(name) && !toolsetsConfig[name].inUse));
  // TODO: add confirmation for configurations that are about to be eliminated with null
  if (stowToolsets.length) {
    vlm.info(`Stowing toolsets:`, vlm.theme.package(...stowToolsets));
    stowToolsets.forEach(name => { toolsets[name] = { inUse: false }; });
    ret.stowed = stowToolsets;
  }
  const grabToolsets = newToolsets
      .filter(name => (toolsetsConfig[name] || { inUse: true }).inUse);
  if (grabToolsets.length) {
    vlm.info(`Grabbing toolsets:`, vlm.theme.package(...grabToolsets));
    const installAsDevDeps = grabToolsets
        .filter(toolsetName => !vlm.getPackageConfig("devDependencies", toolsetName)
            && !vlm.getPackageConfig("dependencies", toolsetName));
    if (installAsDevDeps.length) {
      vlm.info(`Installing toolsets as direct devDependencies:`,
          vlm.theme.package(...installAsDevDeps));
      await vlm.interact(["yarn add -W --dev", ...installAsDevDeps]);
    }
    grabToolsets.forEach(name => { toolsets[name] = { inUse: true }; });
    ret.grabbed = grabToolsets;
  }
  await vlm.updateToolsetsConfig(toolsets);
  return ret;
};
