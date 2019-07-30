exports.vlm = { toolset: "@valos/toolset-domain" };
exports.command = ".configure/.@valos/toolset-domain/.tools/.select/summary";
exports.brief = "";
exports.describe = "Select domain summary revdoc generation tool for a vault workspace";
exports.introduction =
`This toolset-domain tool enables the (re)generation of docs/index.html
domain summary revdoc document.`;

exports.disabled = (yargs) => (yargs.vlm.getValOSConfig("type") !== "vault")
    && `Workspace is not a vault (is ${yargs.vlm.getValOSConfig("type")})`;
exports.builder = (yargs) => yargs.options({
  ...yargs.vlm.createConfigureToolOptions(exports),
  "regenerate-on-release": {
    default: yargs.vlm.getToolConfig(yargs.vlm.toolset, "summary", "regenerateOnRelease"),
    description: "Regenerate domain summary revdoc on each vault (pre)release",
    interactive: { type: "confirm", when: yargs.vlm.reconfigure ? "always" : "if-undefined" },
  },
  "summary-target": {
    default: yargs.vlm.getToolConfig(yargs.vlm.toolset, "summary", "summaryTarget")
        || "revdocs/domain-summary.json",
    description: "Target file for the domain summary regeneration",
    interactive: { type: "confirm", when: yargs.vlm.reconfigure ? "always" : "if-undefined" },
  },
});

exports.handler = (yargv) => ({
  command: exports.command,
  toolsetsUpdate: { [yargv.vlm.toolset]: { tools: { summary: {
    inUse: true,
    regenerateOnRelease: yargv["regenerate-on-release"] || false,
    summaryTarget: yargv["summary-target"] || false,
  } } } },
});
