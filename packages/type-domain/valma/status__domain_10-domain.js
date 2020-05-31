const { createStandardStatusOptions } = require("@valos/type-toolset");

exports.vlm = { toolset: "@valos/type-domain" };
exports.command = ".status/.type/.domain/10-domain";
exports.brief = "display 'type-domain' status";
exports.describe = "Display the toolset '@valos/type-domain' status of this workspace";
exports.introduction = `${exports.describe}.`;

exports.disabled = (yargs) => !yargs.vlm.getToolsetConfig(yargs.vlm.toolset, "inUse")
    && `Toolset '${yargs.vlm.toolset}' not in use`;
exports.builder = (yargs) => yargs.options({
  ...createStandardStatusOptions(yargs.vlm, exports),
});

exports.handler = async (yargv) => {
  const { extension } = require("@valos/vdoc");
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
      { "data#status_toolsets": { "@valos/type-domain": status } },
      { target, omitContext: true });
};
