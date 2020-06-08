const typeToolset = require("@valos/type-toolset");

exports.vlm = { toolset: "@valos/type-toolset" };
exports.command = ".select/.toolsets/@valos/type-toolset";
exports.brief = "select '@valos/type-toolset'";
exports.describe = "Make current workspace selectable as a toolset for other workspaces";
exports.introduction = require("./type/toolset").introduction;

exports.disabled = (yargs) => typeToolset.checkToolsetSelectorDisabled(yargs.vlm, exports);
exports.builder = (yargs) => yargs.options({});

exports.handler = async (yargv) => ({
  devDependencies: { [exports.vlm.toolset]: yargv.vlm.domainVersionTag("@valos/kernel") },
  toolsetsUpdate: { [exports.vlm.toolset]: { inUse: true } },
  success: true,
});
