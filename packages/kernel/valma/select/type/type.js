exports.command = ".select/.type/type";
exports.describe = "Declare a new valos type";
exports.introduction =
`A valos type is a name that can be chosen as a package.json:valos.type
value during workspace init. Each type serves a particular purpose
which is described in the type introduction.

Each type is optionally associated with a specific type toolset which
provides tools and code to implement and support the purpose of the
type. When a type with a type toolset is chosen for a workspace the
type toolsets is automatically configured to be always in use.

As an  example the type 'worker' adds the toolset @valos/type-worker
which provides template files and shared code for managing perspire
gateway execution environments. As a bit more self-referential example
the type 'toolset' adds the toolset @valos/type-toolset which provides
commands and shared code for managing the valos toolset functionality
itself.

Finally, the type of these type toolsets themselves is 'type'. And
conversely initializing a fresh workspace with type 'type' makes the
workspace to be a type toolset, with template files and provisions on
how to implement and make the newly created type available to others.
[NOTE(iridian, 2020-06): These provisions are very provisional, as in
they don't exist yet.]`;

exports.disabled = () => false;
exports.builder = (yargs) => yargs.options({});

exports.handler = (yargv) => ({
  devDependencies: { "@valos/type-toolset": yargv.vlm.domainVersionTag("@valos/kernel") },
  success: true,
});
