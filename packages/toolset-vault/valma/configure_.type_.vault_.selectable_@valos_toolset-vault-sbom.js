exports.vlm = { toolset: "@valos/toolset-vault-sbom" };
exports.command = ".configure/.type/.vault/.selectable/@valos/toolset-vault-sbom";
exports.describe = "Configure generation of software bill of materials dependency summary";
exports.introduction = `${exports.describe}.`;

exports.disabled = (yargs) => !yargs.vlm.getToolsetConfig(yargs.vlm.toolset, "inUse")
    && "Can't configure: not inUse or toolset config missing";
exports.builder = (yargs) => {
  const vlm = yargs.vlm;
  return yargs.options({
    reconfigure: {
      alias: "r", type: "boolean",
      description: `Reconfigure '${exports.command}' config of this workspace.`,
    },
    "release-regenerate": {
      description: "Regenerate software bill of materials on each (pre)release",
      interactive: { type: "confirm", when: vlm.reconfigure ? "always" : "if-undefined" },
    },
  });
};

exports.handler = (yargv) => {
  const vlm = yargv.vlm;
  vlm.updateToolsetConfig(vlm.toolset, {
    commands: {
      [exports.command]: {
        "release-regenerate": yargv["release-regenerate"] || false,
      },
    }
  });
  return { command: exports.command, devDependencies: { "@cyclonedx/bom": true, "xml-js": true } };
};
