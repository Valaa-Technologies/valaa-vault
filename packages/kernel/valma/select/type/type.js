exports.command = ".select/.type/type";
exports.describe = "Declare a new valos type";
exports.introduction =
`A valos type is a name that can be chosen as a package.json:valos.type
during workspace init. Each type serves a particular purpose which is
described in the type introduction.

Each type is optionally associated with a specific type toolset. This
toolset is automatically added as an always-in-use dependency and
provides commands and library code for the workspace.

As an example the type 'worker' adds the toolset @valos/type-worker
which provides template files and shared code for managing perspire
gateway execution environments.

As a bit more self-referential example the type 'toolset' adds the
toolset @valos/type-toolset. This type toolset  provides commands and
shared code for managing the valos toolset functionality itself.

Finally, the type 'type' is the type of all type toolsets themselves.
Initializing a new workspace with type 'type' introduces a new type to
the ValOS ecosystem.`;

exports.disabled = () => false;
exports.builder = (yargs) => yargs.options({});

exports.handler = (yargv) => ({
  devDependencies: { "@valos/type-type": yargv.vlm.domainVersionTag("@valos/kernel") },
  toolsetsUpdate: { "@valos/type-type": { inUse: "always" } },
  success: true,
});
