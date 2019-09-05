exports.command = ".configure/.type/worker";
exports.describe = "Select 'worker' workspace type";
exports.introduction =
`A worker workspace is used to launch and manage a particular service
process. The workspace files contain configuration and data used by the
process. This data can include even dynamic runtime data.

A worker workspace is fully agnostic to version control solutions:
- script-generated workers, where worker is locally spawned by scripts
- clone-and-forget workers, where worker is cloned from a versioned
  upstream repository, has its configuration locally customized and
  local content potentially overridden. No further download sync is
  expected nor will workers push updates back upstream. Each clone
  represents its own computation.
- synchronized workers, where the versioned repository itself
  represents the worker process. Worker workspace shards (there can be
  many if the computation is parallelizable) are still cloned from the
  versioned upstream. Unlike with clone-and-forget workers the
  synchronized worker workspaces keep themselves in sync with
  upstream configuration and data changes and adjust their computation
  accordingly.
  Sync workers shards can even push results back to the versioned
  repository if appropriate.`;

exports.disabled = (yargs) => (yargs.vlm.getValOSConfig("type") !== "worker")
    && `Workspace is not a 'worker' (is '${yargs.vlm.getValOSConfig("type")}')`;
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
