const typeToolset = require("@valos/type-toolset");

exports.vlm = { toolset: "@valos/toolset-revealer" };
exports.command = ".configure/.toolsets/@valos/toolset-revealer";
exports.brief = "configure toolset";
exports.describe = "Configure the toolset 'toolset-revealer' within the current workspace";
exports.introduction = `${exports.describe}.

As a toolset this script is automatically called by configure.`;

exports.disabled = (yargs) => typeToolset.checkToolsetDisabled(yargs.vlm, exports);
exports.builder = (yargs) => yargs.options({
  ...typeToolset.createConfigureToolsetOptions(yargs.vlm, exports),
});

exports.handler = async (yargv) => {
  const vlm = yargv.vlm;
  const toolsetConfig = vlm.getToolsetConfig(exports.vlm.toolset) || {};

  vlm.instruct(`! Edit ${vlm.theme.path("webpack.config.js")
      } to configure webpack entry and output locations.`);

  if (!toolsetConfig.webpack) {
    vlm.updateToolsetConfig(vlm.toolset, {
      webpack: {
        entry: {
          "valos-inspire": "./node_modules/@valos/inspire/index.js",
          // TODO(iridian, 2020-05): Add inquiries for adding spindle bundles.
        },
        output: {
          path: "dist/revealer/valos/inspire/",
          publicPath: "/valos/inspire/",
          filename: "[name].js"
        }
      }
    });
    vlm.instruct(`! Edit toolsets.json:['${vlm.theme.package(vlm.toolset
        )}'].webpack to further configure webpack entry and output locations.`);
  }
  const selectionResult = await typeToolset.configureToolSelection(
      vlm, vlm.toolset, yargv.reconfigure, yargv.tools);
  return { success: true, command: exports.command, ...selectionResult };
};
