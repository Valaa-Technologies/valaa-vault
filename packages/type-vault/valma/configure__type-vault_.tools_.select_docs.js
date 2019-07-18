exports.vlm = { toolset: "@valos/type-vault" };
exports.command = ".configure/.@valos/type-vault/.tools/.select/docs";
exports.describe = "Select vault /docs generation tool";
exports.introduction = `${exports.describe}.

`;

exports.disabled = (yargs) => (yargs.vlm.getValOSConfig("type") !== "vault")
    && `Workspace is not a vault (is ${yargs.vlm.getValOSConfig("type")})`;
exports.builder = (yargs) => yargs.options({
  ...yargs.vlm.createConfigureToolOptions(exports),
  "regenerate-on-release": {
    default: yargs.vlm.getToolConfig(yargs.vlm.toolset, "docs", "regenerateOnRelease"),
    description: "Regenerate software bill of materials on each (pre)release",
    interactive: { type: "confirm", when: yargs.vlm.reconfigure ? "always" : "if-undefined" },
  },
  "docs-base-iri": {
    type: "string",
    default: yargs.vlm.getToolConfig(yargs.vlm.toolset, "docs", "docsBaseIRI"),
    description: "The public base URI of the final published vault documents",
    interactive: { type: "input", when: yargs.vlm.reconfigure ? "always" : "if-undefined" },
  },
});

exports.handler = (yargv) => ({
  command: exports.command,
  devDependencies: { "@cyclonedx/bom": true, "xml-js": true },
  toolsetsUpdate: { [yargv.vlm.toolset]: { tools: { docs: {
    inUse: true,
    regenerateOnRelease: yargv["regenerate-on-release"] || false,
    docsBaseIRI: yargv["docs-base-iri"] || "",
    authors: {},
    introduction: [],
  } } } },
});
