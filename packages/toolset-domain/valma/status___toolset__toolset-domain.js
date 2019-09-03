exports.vlm = { toolset: "@valos/toolset-domain" };
exports.command = ".status/40-toolsets/@valos/toolset-domain";
exports.brief = "display 'toolset-domain' status";
exports.describe = "Display the toolset '@valos/toolset-domain' status of this workspace";
exports.introduction = `${exports.describe}.`;

exports.disabled = (yargs) => !yargs.vlm.getToolsetConfig(yargs.vlm.toolset, "inUse")
    && `Toolset '${yargs.vlm.toolset}' not in use`;
exports.builder = (yargs) => yargs.options({
  "include-tools": {
    type: "boolean", default: true,
    description: "Include tool status report breakdown in results",
  },
});

exports.handler = async (yargv) => {
  const { extension /* , extractee: { ref } */ } = require("@valos/vdoc");
  const patchWith = require("@valos/tools/patchWith").default;
  const vlm = yargv.vlm;
  const toolsetConfig = vlm.getToolsetConfig(vlm.toolset);
  const warnings = [];
  const failures = [];
  const target = {};
  const underscoredToolset = vlm.toolset.replace(/[/@-]/g, "_");
  for (const [tool/* , toolConfig */] of Object.entries((toolsetConfig || {}).tools || {})) {
    const toolStatuses = await yargv.vlm.invoke(
        `.status/.tool/${tool}*`, [{ toolset: vlm.toolset }]);
    for (const results of [].concat(...(toolStatuses || []))) {
      if (yargv["include-tools"]) patchWith(target, results);
      const toolResult = results[`status_toolset_${underscoredToolset}_tools`][tool];
      if (toolResult.warnings) warnings.push(...toolResult.warnings.map(w => `${tool}: ${w}`));
      if (toolResult.failures) failures.push(...toolResult.failures.map(f => `${tool}: ${f}`));
    }
  }
  const status = !warnings.length && !failures.length ? { success: "OK" }
      : !failures.length ? { warnings }
      : { failures, warnings };
  return extension.extract(
      { "data#status_toolsets": { "@valos/toolset-domain": status } },
      { target, omitContext: true });
};
