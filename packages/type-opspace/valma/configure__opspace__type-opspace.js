exports.vlm = { toolset: "@valos/type-opspace" };
exports.command = ".configure/.type/.opspace/@valos/type-opspace";
exports.describe = "Configure the 'type-opspace' toolset";
exports.introduction = `${exports.describe}.

Adds valma commands 'build-release' and 'deploy-release'.

Copies vault monorepo config file templates to this vault workspace
root from package @valos/type-opspace directory templates/.*.

The purpose of opspaces is to have a centralized, configurable,
granular and versioned system for building and deploying releases.

A release deployment is the process of making changes to a live remote
system. A deployment can modify external infrastructure code, update
configurations and upload new file content to the targeted live system.

Ideally each deployment would be fully atomic but as opspaces are
designed to be used against arbitrary systems this is often not
feasible. To overcome this limitation and still maintain consistency
following strategy is used:

1. the release process is divided to two stages which are separately
   initiated by valma commands 'build-release' and 'deploy-release'.
   This separation is to ensure eventual completion of deployments and
   importantly to facilitate the understanding of particular opspace
   release deployment process by allowing a DevOps to inspect and test
   the intermediate release build locally even if everything is fine.
2. The output of the 'build-release' stage is the release itself:
   an isolated set of files in a local directory (usually
   'dist/release/<version>'). These release files contain the diff-sets
   which the 'deploy-release' consumes. The release files are intended
   to be perused and understood by DevOps.
4. The release is divided into atomic, versioned sub-releases to ensure
   consistency during each point during the full deployment.
   Sub-releases have their own versions and can have (non-cyclic)
   dependencies to each other.
5. A single sub-release is typically created by a single valma toolset
   or tool with its own customized build-release detail commands.
6. build-release detail commands evaluate the local opspace
   modifications and compares them to the actually deployed state. This
   difference is used to construct the minimal set of atomic, locally
   persisted, individually versioned sub-releases.
7. deploy-release stage deploy each sub-release and ensures that
   a deployment for all dependents complete before their depending
   deployments are initiated.
`;

// Example template which displays the command name itself and package name where it is ran
// Only enabled inside package
exports.disabled = (yargs) => (yargs.vlm.getValOSConfig("type") !== "opspace")
    && `Workspace is not an opspace (is ${yargs.vlm.getValOSConfig("type")})`;
exports.builder = (yargs) => yargs.options({
  reconfigure: {
    alias: "r", type: "boolean",
    description: "Reconfigure 'type-opspace' config of this workspace.",
  },
});

exports.handler = (yargv) => {
  const vlm = yargv.vlm;
  const templates = vlm.path.join(__dirname, "../templates/{.,}*");
  vlm.info("Copying missing opspace config files", " from templates at:",
      vlm.theme.path(templates), "(will not clobber existing files)");
  vlm.shell.cp("-n", templates, ".");
  return { command: exports.command };
};
