exports.vlm = { toolset: "@valos/web-spindle" };
exports.command = ".configure/.type/.worker/.select/@valos/web-spindle";
exports.brief = "select web-spindle";
exports.describe = "Project http/s requests to valospace-fabric via a gateway plugin";
exports.introduction =
`Selects web-spindle as a worker tool.`;

exports.disabled = (yargs) => (yargs.vlm.getValOSConfig("type") !== "worker")
    && `Workspace is not a worker`;
exports.builder = (yargs) => yargs.options({});

exports.handler = async (yargv) => ({
  devDependencies: { [exports.vlm.toolset]: yargv.vlm.domainVersionTag("@valos/kernel") },
  toolsetsUpdate: { [exports.vlm.toolset]: { inUse: true } },
  success: true,
});
