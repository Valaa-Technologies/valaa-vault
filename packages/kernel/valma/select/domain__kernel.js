exports.command = ".select/.domain/@valos/kernel";
exports.brief = "select @valos/kernel domain";
exports.describe = "Contribute to Valaa Open System core components";
exports.introduction =
`@valos/kernel domain is the Valaa Open System core namespace the
foundation of the ValOS ecosystem.

All packages in this namespace must have some open source license (MIT,
BSD, GPL, ?) and be publicly available.
`;

exports.disabled = () => false;
exports.builder = (yargs) => yargs.options({
  reconfigure: {
    alias: "r", type: "boolean",
    description: "Reconfigure '@valos/kernel' domain for this workspace.",
  },
});

exports.handler = () => ({ success: true });
