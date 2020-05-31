const { createConfigureToolOptions } = require("@valos/type-toolset");

exports.vlm = { toolset: "@valos/type-vault" };
exports.command = ".configure/.@valos/type-vault/.tools/.select/docs";
exports.brief = "select docs generation";
exports.describe = "Generate /docs html files from all vault revdocs files";
exports.introduction =
`This type-vault tool provides commands for (re)generating the /docs
folder from document sources present in the local workspaces, notably
all revdoc documents matching glob '*.revdoc{,.test}.js'.
Additionally this tool can be configured to regenerate all docs on
(pre)release time.`;

exports.disabled = (yargs) => (yargs.vlm.getValOSConfig("type") !== "vault")
    && `Workspace is not a vault`;

exports.builder = (yargs) => yargs.options({
  ...createConfigureToolOptions(yargs.vlm, exports),
  "regenerate-on-release": {
    default: yargs.vlm.getToolConfig(yargs.vlm.toolset, "docs", "regenerateOnRelease"),
    description: "Regenerate software bill of materials on each (pre)release",
    interactive: { type: "confirm", when: yargs.vlm.reconfigure ? "always" : "if-undefined" },
  },
  "docs-base-iri": {
    type: "string",
    default: yargs.vlm.getToolConfig(yargs.vlm.toolset, "docs", "docsBaseIRI"),
    description: "The public base IRI of the final published vault documents",
    interactive: { type: "input", when: yargs.vlm.reconfigure ? "always" : "if-undefined" },
  },
});

exports.handler = (yargv) => {
  const vlm = yargv.vlm;
  const kernelVersionTag = vlm.domainVersionTag("@valos/kernel");
  return {
    command: exports.command,
    devDependencies: {
      "@cyclonedx/bom": "latest",
      "xml-js": "latest",
      "@valos/vdoc": kernelVersionTag,
      "@valos/revdoc": kernelVersionTag,
      "@valos/sbomdoc": kernelVersionTag,
    },
    toolsetsUpdate: { [yargv.vlm.toolset]: { tools: { docs: {
      inUse: true,
      regenerateOnRelease: yargv["regenerate-on-release"] || false,
      docsBaseIRI: yargv["docs-base-iri"] || "",
      authors: {},
      introduction: [],
    } } } },
  };
};
