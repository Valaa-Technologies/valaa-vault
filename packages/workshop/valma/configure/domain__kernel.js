exports.command = ".configure/.domain/@valos/kernel";
exports.describe = "Configure this workspace as part of the @valos/kernel domain";
exports.introduction = `${exports.describe}.

@valos/kernel domain forms the Valaa Open System core namespace and is
the foundation of the ValOS ecosystem.

All packages in this namespace must have some open source license (MIT,
BSD, GPL, ?) and be publicly available.
`;

exports.disabled = (yargs) => (yargs.vlm.getValOSConfig("domain") !== "@valos/kernel")
    && `Workspace domain is not '@valos/kernel' (is '${yargs.vlm.getValOSConfig("domain")}')`;
exports.builder = (yargs) => yargs.options({
  reconfigure: {
    alias: "r", type: "boolean",
    description: "Reconfigure all '@valos/kernel' domain config of this workspace.",
  },
});

exports.handler = (yargv) =>
    yargv.vlm.invoke(`.configure/.domain/.@valos/kernel/**/*`, { reconfigure: yargv.reconfigure });
