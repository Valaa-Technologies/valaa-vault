const typeToolset = require("@valos/type-toolset");

exports.vlm = { toolset: "@valos/authority-spindle" };
exports.command = ".select/.toolsets/.type/worker/@valos/authority-spindle";
exports.brief = "select toolset '@valos/authority-spindle'";
exports.describe = "Host a standalone authority using web-spindle route projectors";
exports.introduction = `${exports.describe}.

Requires @valos/web-spindle toolset to be in use.
`;

exports.disabled = (yargs) => typeToolset.checkToolsetSelectorDisabled(yargs.vlm, exports,
    { type: "worker" });
exports.builder = (yargs) => yargs.options({});

exports.handler = async (yargv) => ({
  // TODO(iridian, 2021-03): Check that web-spindle is also selected
  devDependencies: {
    [exports.vlm.toolset]: yargv.vlm.domainVersionTag("@valos/kernel"),
  },
  toolsetsUpdate: { [exports.vlm.toolset]: { inUse: true } },
  success: true,
});
