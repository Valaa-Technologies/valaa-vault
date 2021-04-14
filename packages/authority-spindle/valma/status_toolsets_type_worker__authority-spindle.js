const typeToolset = require("@valos/type-toolset");

exports.vlm = { toolset: "@valos/authority-spindle" };
exports.command = ".status/.toolsets/.type/worker/@valos/authority-spindle";
exports.brief = "display toolset status";
exports.describe = "Display the toolset '@valos/authority-spindle' status of this workspace";
exports.introduction = `${exports.describe}.`;

exports.disabled = (yargs) => typeToolset.checkToolsetDisabled(yargs.vlm, exports);
exports.builder = (yargs) => yargs.options({
  ...typeToolset.createStatusToolsetOptions(yargs.vlm, exports),
});

exports.handler = async (yargv) => {
  const { extension } = require("@valos/vdoc");
  const patchWith = require("@valos/tools/patchWith").default;
  const vlm = yargv.vlm;
  const toolsetConfig = vlm.getToolsetConfig(exports.vlm.toolset);
  const warnings = [];
  const failures = [];
  const target = {};
  const underscoredToolset = vlm.toolset.replace(/[/@-]/g, "_");
  for (const [tool/* , toolConfig */] of Object.entries((toolsetConfig || {}).tools || {})) {
    const toolStatuses = await yargv.vlm.invoke(
        `.status/.tools/${tool}*`, [{ toolset: vlm.toolset }]);
    for (const results of [].concat(...(toolStatuses || []))) {
      if (yargv["include-tools"]) patchWith(target, results, { spreaderKey: "..." });
      const toolResult = results[`status_toolset_${underscoredToolset}_tools`][tool];
      if (toolResult.warnings) warnings.push(...toolResult.warnings.map(w => `${tool}: ${w}`));
      if (toolResult.failures) failures.push(...toolResult.failures.map(f => `${tool}: ${f}`));
    }
  }
  const status = !warnings.length && !failures.length ? { success: "OK" }
      : !failures.length ? { warnings }
      : { failures, warnings };
  return extension.extract(
      { "data#status_toolsets": { "@valos/authority-spindle": status } },
      { target, omitContext: true });
};
