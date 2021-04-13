const { createSelectToolsetsOption, configureToolsetSelection } = require("@valos/type-toolset");

exports.command = ".configure/select-toolsets";
exports.describe = "Select and stow toolsets from the set available toolsets";
exports.introduction =
`The set of available toolsets in a given package context is defined via
the set of all valma toolset configuration commands at that package
root directory as:

vlm -N '.select/.toolsets/{,.domain/<domain>/}{,.type/<type>/,}{,.workspace/<name>}/**/*'

When a toolset is selected to be in use it is always added as a direct
devDependency for the package if it is not already.

After select-toolsets has been used to select a subset of the available
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
      : (valos.domain == null) ? "No package.json valos.domain stanza found"
      : !yargs.vlm.getToolsetsConfig() && "No toolsets.json found";
};

exports.builder = (yargs) => yargs.options({
  toolsets: createSelectToolsetsOption(yargs.vlm, exports),
  add: {
    type: "string", array: true,
    description: "Add explicit toolsets to the selection (even if unavailable)",
  },
  reconfigure: {
    alias: "r", type: "boolean",
    description: "Reconfigure all toolsets even if they are already selected or configured.",
  },
});

exports.handler = async (yargv) =>
    configureToolsetSelection(yargv.vlm, yargv.reconfigure,
        (yargv.toolsets || []).concat(yargv.add || []), yargv._);
