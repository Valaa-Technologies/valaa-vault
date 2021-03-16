const typeToolset = require("@valos/type-toolset");

exports.vlm = { toolset: "@valos/authority-spindle" };
exports.command = ".select/.toolsets/.type/worker/@valos/authority-spindle";
exports.brief = "select toolset '@valos/authority-spindle'";
exports.describe = "ValOS authority web route projectors spindle";
exports.introduction = `${exports.describe}.

[Edit the introduction for the toolset '@valos/authority-spindle' here - the first line
of introduction is seen during toolset selection process.]

[Once finalized this command should be transferred to the domain
package '@valos/kernel'. Once transferred then all workspaces
that use that domain can select '@valos/authority-spindle' as a toolset via
'vlm configure' given that all selection restrictor conditions are
satisfied.]
`;

exports.disabled = (yargs) => typeToolset.checkToolsetSelectorDisabled(yargs.vlm, exports,
    {"type":"worker"});
exports.builder = (yargs) => yargs.options({});

exports.handler = async (yargv) => ({
  // This code is executed immediately after the toolset selection is
  // confirmed and should return the toolsets.json config update and
  // the devDependencies that are needed by the toolset itself.
  //
  // One-shot code that doesn't depend on any other packages can be
  // executed here, although majority of the toolset configuration
  // should happen in the toolset configure command.
  //
  // Finally, once complete, this file and its package.json bin section
  // command entry should be moved to the domain package '@valos/kernel'
  // so that the toolset becomes available for 'vlm select-toolsets'.
  devDependencies: {
    [exports.vlm.toolset]: yargv.vlm.domainVersionTag("@valos/kernel"),
  },
  toolsetsUpdate: { [exports.vlm.toolset]: { inUse: true } },
  success: true,
});
