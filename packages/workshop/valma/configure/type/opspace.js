exports.command = ".configure/.type/opspace";
exports.describe = "Initialize opspace workspace";
exports.introduction =
`An opspaces workspace is used to for configuring, deploying, updating,
monitoring and diagnosing all types of live infrastructure resources.

Opspaces rely heavily on various toolsets to get their job done.
Opspaces rarily are published and packages and typically reside in
"opspaces/*" vault workspace directory`;

exports.disabled = (yargs) => (yargs.vlm.getValOSConfig("type") !== "opspace")
    && `Workspace is not an 'opspace' (is '${yargs.vlm.getValOSConfig("type")}')`;
exports.builder = (yargs) => yargs.options({
  reconfigure: {
    alias: "r", type: "boolean",
    description: "Reconfigure all 'opspace' configurations of this workspace.",
  },
});

exports.handler = () => ({
  devDependencies: { "@valos/type-opspace": true },
  toolsetsUpdate: { "@valos/type-opspace": { inUse: "always" } },
  success: true,
});
