exports.command = ".configure/.type/spindle";
exports.describe = "Select 'spindle' workspace type";
exports.introduction =
`A gateway spindle extends inspire and perspire gateways with various
functionalities.

Core spindles provide new resource schemas, media decoders, protocol
schemes, external APIs, valosheath APIs, etc.

Custom spindles can be plugged into workers for arbitrary code but are
only available on inspire if they are explicitly bundled with it.

Spindles load their configuration from the gateway revelation. When a
particular spindle is configured for a perspire worker its
configuration is typically placed as a tool the toolset.
`;

exports.disabled = (yargs) => (yargs.vlm.getValOSConfig("type") !== "spindle")
    && `Workspace is not a spindle`;
exports.builder = (yargs) => yargs.options({
  reconfigure: {
    alias: "r", type: "boolean",
    description: "Reconfigure all 'spindle' configurations of this workspace.",
  },
});

exports.handler = (yargv) => ({
  devDependencies: { "@valos/type-spindle": yargv.vlm.domainVersionTag("@valos/kernel") },
  toolsetsUpdate: { "@valos/type-spindle": { inUse: "always" } },
  success: true,
});
