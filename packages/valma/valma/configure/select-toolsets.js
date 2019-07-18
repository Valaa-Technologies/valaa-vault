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
1. adding a devDependency to a workshop package which aggregates
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
exports.builder = (yargs) => {
  const toolsetsConfig = yargs.vlm.getToolsetsConfig();
  if (!toolsetsConfig) throw new Error("toolsets.json missing (maybe run 'vlm init'?)");
  if (this.disabled(yargs)) throw new Error("package.json missing stanza .valos.(type|domain)");
  const valos = yargs.vlm.packageConfig.valos || yargs.vlm.packageConfig.valaa;
  const knownToolsets = yargs.vlm
      .listMatchingCommands(
          `.configure/{,.type/.${valos.type}/,.domain/.${valos.domain}/}.select/**/*`)
      .map(name => name.match(/\/.select\/(.*)$/)[1]);
  const configuredToolsets = Object.keys(toolsetsConfig || {});
  const usedToolsets = configuredToolsets
      .filter(name => (toolsetsConfig[name] || {}).inUse);
  const allToolsets = knownToolsets.concat(
      configuredToolsets.filter(toolset => !knownToolsets.includes(toolset)));
  return yargs.options({
    reconfigure: {
      alias: "r", type: "boolean",
      description: "Reconfigure all newly grabbed toolsets even if they are already configured.",
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
  const valos = vlm.packageConfig.valos || vlm.packageConfig.valaa;
  const toolsetsConfig = vlm.getToolsetsConfig();
  if (!toolsetsConfig) return undefined;

  const newToolsets = yargv.toolsets || [];
  const toolsets = {};
  const ret = {};

  const stowToolsets = Object.keys(toolsetsConfig)
      .filter(name => (!newToolsets.includes(name) && toolsetsConfig[name].inUse));
  // TODO: add confirmation for configurations that are about to be eliminated with null
  if (stowToolsets.length) {
    vlm.info(`Stowing toolsets:`, vlm.theme.package(...stowToolsets));
    stowToolsets.forEach(name => { toolsets[name] = { inUse: false }; });
    ret.stowed = stowToolsets;
  }
  const grabbedToolsets = newToolsets
      .filter(name => !(toolsetsConfig[name] || { inUse: false }).inUse);
  if (grabbedToolsets.length) {
    vlm.info(`Grabbing toolsets:`, vlm.theme.package(...grabbedToolsets));
    grabbedToolsets.forEach(name => { toolsets[name] = { inUse: true }; });
    ret.grabbed = grabbedToolsets;
  }
  await vlm.updateToolsetsConfig(toolsets);
  const devDependencies = {};
  for (const toolsetName of (yargv.reconfigure ? newToolsets : grabbedToolsets)) {
    const configureResults = await vlm.invoke(
        `.configure/{,.type/.${valos.type}/,.domain/.${valos.domain}/}.select/${toolsetName}`);
    for (const result of configureResults) {
      Object.assign(devDependencies, (result || {}).devDependencies || {});
    }
  }
  const newDevDependencies = Object.keys(devDependencies)
      .filter(devDependencyName => !vlm.getPackageConfig("devDependencies", devDependencyName)
          && !vlm.getPackageConfig("dependencies", devDependencyName));
  if (newDevDependencies.length) {
    vlm.info(`Installing new toolset devDependencies:`,
        vlm.theme.package(...newDevDependencies));
    await vlm.interact(["yarn add -W --dev", ...newDevDependencies]);
  }
  const rest = [{ reconfigure: yargv.reconfigure || false }, ...yargv._];
  vlm.info(`Configuring all toolsets:`);
  ret.toolsets = await vlm.invoke(
      `.configure/{,.type/.${valos.type}/,.domain/.${valos.domain}/}.toolset/**/*`, rest);
  return ret;
};
