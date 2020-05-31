exports.vlm = { toolset: "@valos/type-toolset" };
exports.command = ".configure/.select/@valos/type-toolset";
exports.brief = "select toolset '@valos/type-toolset'";
exports.describe = "Select the toolset '@valos/type-toolset' for the current workspace";
exports.introduction = require("./type/toolset").introduction;

exports.disabled = (yargs) => !yargs.vlm.packageConfig;
exports.builder = (yargs) => yargs.options({});

exports.handler = async (yargv) => ({
  devDependencies: { [exports.vlm.toolset]: yargv.vlm.domainVersionTag("@valos/kernel") },
  toolsetsUpdate: { [exports.vlm.toolset]: { inUse: true } },
  success: true,
});
