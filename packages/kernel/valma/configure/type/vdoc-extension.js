exports.command = ".configure/.type/vdoc-extension";
exports.describe = "Select 'vdoc-extension' workspace type";
exports.introduction =
`A vdoc-extension workspace contains the extension specification and
supporting libraries for a VDoc extension. It inherits library
workspace characteristics but has a specific structure and initial
templates which is useful for VDoc extensions in specific.
`;

exports.disabled = (yargs) => (yargs.vlm.getValOSConfig("type") !== "vdoc-extension")
    && `Workspace is not a vdoc-extension`;
exports.builder = (yargs) => yargs.options({
  reconfigure: {
    alias: "r", type: "boolean",
    description: "Reconfigure all 'vdoc-extension' configurations of this workspace.",
  },
});

exports.handler = () => ({ success: true });
