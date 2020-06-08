const typeToolset = require("@valos/type-toolset");

exports.vlm = { toolset: "@valos/toolset-revealer" };
exports.command = ".select/.toolsets/@valos/toolset-revealer";
exports.brief = "select '@valos/toolset-revealer'";
exports.describe = "Run 'vlm rouse-revealer' to serve local inspire sites with webpack-dev-server";
exports.introduction =
`This toolset enables valma command 'rouse-revealer' for deploying a
local dev environment for inspire gateway revelations.

Sets up the webpack entry and output config as webpack.config.js in
the workspace root, which combines shared revealer config from
@valos/toolset-revealer/shared/webpack.config.js, local toolset config
and any customizations in the root webpack.config.js itself.`;

// Example template which displays the command name itself and package name where it is ran
// Only enabled inside package
exports.disabled = (yargs) => typeToolset.checkToolsetSelectorDisabled(yargs.vlm, exports);
exports.builder = (yargs) => yargs.options({});

exports.handler = async (yargv) => ({
  devDependencies: {
    [exports.vlm.toolset]: yargv.vlm.domainVersionTag("@valos/kernel"),
    ...(!yargv.vlm.getPackageConfig("devDependencies", "@valos/inspire")
        && await yargv.vlm.inquireConfirm(
            `Add @valos/inspire in devDependencies? (rouse-revealer has it as a peerDependency)`)
        ? {
          "@valos/inspire": yargv.vlm.domainVersionTag("@valos/kernel"),
        } : {}),
  },
  toolsetsUpdate: { [exports.vlm.toolset]: { inUse: true } },
  success: true,
});
