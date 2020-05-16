const shared = require("@valos/toolset-revealer/shared/webpack.config");
const path = require("path");

const toolsetWebpackConfig =
    require(`${process.cwd()}/toolsets`)["@valos/toolset-revealer"].webpack;
toolsetWebpackConfig.output.path = path.posix.resolve(toolsetWebpackConfig.output.path);

module.exports = {
  ...shared,
  ...toolsetWebpackConfig,
  // Add overrides here
};
