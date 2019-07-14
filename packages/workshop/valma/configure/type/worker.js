exports.command = ".configure/.type/worker";
exports.describe = "Configure a 'worker' workspace";
exports.introduction = `${exports.describe}.

A worker repository is used to launch and manage a running process.
The repository files contain configuration and data used by the
process. This data can include even dynamic runtime data.

A worker repository is fully agnostic to version control solutions:
- script-generated workers, where worker is locally spawned by scripts
- clone-and-forget workers, where worker is cloned from a versioned
  upstream repository, has its configuration locally customized and
  local content potentially overridden. No further download sync is
  expected nor will workers push updates back upstream. Each clone
  represents its own computation.
- synchronized workers, where the versioned repository itself
  represents the process. Worker repository shards (there can be many
  if the computation is parallelizable) are still cloned from the
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

exports.handler = async (yargv) => {
  const vlm = yargv.vlm;
  if (!vlm.getPackageConfig("devDependencies", "@valos/toolset-worker")) {
    await vlm.interact("yarn add -W --dev @valos/toolset-worker");
  }
  return vlm.invoke(`.configure/.type/.worker/**/*`, { reconfigure: yargv.reconfigure });
};
