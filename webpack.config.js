const shared = require("@valos/toolset-revealer/shared/webpack.config");
const path = require("path");

const toolsetWebpackConfig =
    require(`${process.cwd()}/toolsets`)["@valos/toolset-revealer"].webpack;
toolsetWebpackConfig.output.path = path.posix.resolve(toolsetWebpackConfig.output.path);

module.exports = {
  ...shared,
  ...toolsetWebpackConfig,
  devServer: {
    ...shared.devServer,
    publicPath: `/valos/inspire/`,
  },
  module: {
    ...shared.module,
    rules: [
      { use: { loader: "babel-loader" }, test: /\.js$/, exclude: /node_modules/, },
      ...shared.module.rules.map(rule => (
          rule.use && (rule.use[0] === "style-loader")
              ? {
                ...rule,
                include: /packages/,
              }
          : rule
      ))
    ],
  },
};
