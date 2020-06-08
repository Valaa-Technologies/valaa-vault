const typeToolset = require("@valos/type-toolset");

exports.vlm = { toolset: "@valos/web-spindle" };
exports.command = ".select/.toolsets/.type/worker/@valos/web-spindle";
exports.brief = "select web-spindle";
exports.describe = "Project http/s requests to valospace-fabric via a gateway plugin";
exports.introduction =
`Selects web-spindle as a worker toolset.`;

exports.disabled = (yargs) => typeToolset.checkToolsetSelectorDisabled(yargs.vlm, exports,
  { type: "worker" });
exports.builder = (yargs) => yargs.options({});

exports.handler = async (yargv) => ({
  devDependencies: { [exports.vlm.toolset]: yargv.vlm.domainVersionTag("@valos/kernel") },
  toolsetsUpdate: { [exports.vlm.toolset]: { inUse: true } },
  success: true,
});
