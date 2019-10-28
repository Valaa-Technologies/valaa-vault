exports.command = ".configure/.type/vault";
exports.describe = "Select 'vault' workspace type";
exports.introduction =
`A vault is a *monorepository* which contains multiple sub-workspaces
of various types. Vaults are used to group packages with high cohesion
together so that development, testing, review and deployment workflows
can be done within a single repository when feasible.

Vault is primarily an organizational unit and is hosted in a single
version control repository. All sub-workspaces have identical access
rights for all contributors. All sub-workspaces must have similar
licences. Exceptions to this must be clearly noted both in the
exceptional workspace root document as well as in the vault root
document.

A vault can have different types of workspaces in it; some of these
(such as libraries, toolsets) may be published to repositories as
*packages* so that they can be used as dependencies for other
workspaces. Others are only local and used for other purposes;
*opspaces* contain configurations and tools for managing infrastructure
configurations and *workers* contain files for spawning local processes.

No matter what the valos type of the domain all share important
qualities: they can have package dependencies, are versioned and are
managed by valma.

A vault often also manages a *domain* for the packages it publishes via
a *domain package*. Domain is a discovery construct. When
a domain package is added as a devDependency to some external package
then valma will be able to list and configure any applicable toolsets
and other workspaces for this package.
`;

exports.disabled = (yargs) => (yargs.vlm.getValOSConfig("type") !== "vault")
    && `Workspace is not a 'vault' (is '${yargs.vlm.getValOSConfig("type")}')`;
exports.builder = (yargs) => {
  const vlm = yargs.vlm;
  const current = (vlm.getPackageConfig("workspaces") || []).join(",");
  return yargs.options({
    reconfigure: {
      alias: "r", type: "boolean",
      description: "Reconfigure all 'vault' configurations of this workspace.",
    },
    workspaces: {
      type: "string", default: current || "packages/*",
      interactive: {
        type: "input", when: !current ? "always" : "if-undefined",
        message: "Set package.json .workspaces stanza globs as a comma-separated list.",
      }
    },
  });
};

exports.handler = async (yargv) => {
  const vlm = yargv.vlm;
  if ((vlm.getPackageConfig("workspaces") || []).join(",") !== yargv.workspaces) {
    await vlm.updatePackageConfig({ workspaces: [yargv.workspaces] });
    // await vlm.interact("yarn install");
  }
  return {
    devDependencies: { "@valos/type-vault": vlm.domainVersionTag("@valos/kernel") },
    toolsetsUpdate: { "@valos/type-vault": { inUse: "always" } },
    success: true,
  };
};
