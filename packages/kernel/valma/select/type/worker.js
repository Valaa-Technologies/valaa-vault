exports.command = ".select/.type/worker";
exports.describe = "Execute perspire gateway as a Node.js process in this workspace";
exports.introduction =
`A worker workspace contains configuration and data (both static and
runtime) and library dependencies used by the on-going process.

The worker directories are less opinionated and thus more flexible than
other valos types. They can be ad-hoc, script-generated, zipped and
copy-distributed, stored inside containers, stored in version control
(or not), sharded, etc. The package.json is only used to source in
the dependencies. Toolsets.json not only hosts configuration but can
also contain dynamic state.
`;

exports.disabled = () => false;
exports.builder = (yargs) => yargs.options({
  reconfigure: {
    alias: "r", type: "boolean",
    description: "Reconfigure all 'worker' configurations of this workspace.",
  },
});

exports.handler = (yargv) => ({
  devDependencies: { "@valos/type-worker": yargv.vlm.domainVersionTag("@valos/kernel") },
  toolsetsUpdate: { "@valos/type-worker": { inUse: "always" } },
  success: true,
});
