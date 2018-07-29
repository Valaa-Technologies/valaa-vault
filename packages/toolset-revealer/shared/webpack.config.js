const webpack = require("webpack");
const autoprefixer = require("autoprefixer");

const UglifyJSPlugin = require("uglifyjs-webpack-plugin");
const CompressionPlugin = require("compression-webpack-plugin");
const vdoc = require("@valos/tools/vdoc");

// TODO(iridian): Figure out the clean and correct way to set up prod configuration; merely
// running 'webpack -p' is not sufficient to enable isProduction, as -p only enables
// NODE_ENV = 'production' for the source files not for webpack.config.js itself.
// See https://github.com/webpack/webpack/issues/2537 . Possible solution Candidates involve
// splitting the config to separate webpack.dev/prod/commin.config.js, or having some other way to
// signal production build (there are arguments that NODE_ENV is supposed to describe the execution
// environment, not the requested build and these two should not be conflated. I've no strong
// opinion on this yet).
// FIXME(iridian): On further attempts both -p as well as NODE_ENV=production break the actual
// builds later on down the line.
// So as it stands now a production build can be triggered manually by running
// `TARGET_ENV=production webpack`

const isProduction = (process.env.TARGET_ENV === "production");
const isLocal = (process.env.TARGET_ENV === "local");

if (isProduction) {
  console.info("Production webpack inspire bundle - tight (not full) uglify + gzip");
} else if (isLocal) {
  console.info(`\n\nLOCAL webpack inspire bundle - no uglify, no gzip\n\n`);
} else {
  console.info(`\n\nNON-PRODUCTION webpack inspire bundle - simple uglify + gzip\n\n`);
}

module.exports = vdoc({ "...": { heading:
    "Shared revealer webpack.config.js configuration",
},
  0: [`This webpack configuration file contains the shared settings
    across all revealer deployments. It is intended to be require'd by
    particular deployment entry point webpack.config.js files.
    These entry configurations can then override and customize these
    base rules. (The template webpack.config.js)[templates/webpack.config.js]
    is deployed automatically to any repository which grabs and
    configures toolset-revealer as an in-use toolset.`
  ],
})({
  context: process.cwd(),
  devtool: "source-map",

  entry: [`src/index.js`],
  output: {
    path: `dist/revealer`,
    publicPath: "/",
    filename: "main.js",
  },
  devServer: {
    disableHostCheck: true,
    compress: true,
  },
  node: {
    fs: "empty",
  },
  plugins: [
    new webpack.DefinePlugin({
      "process.env": {
        NODE_ENV: JSON.stringify(isProduction ? "production" : process.env.NODE_ENV)
      },
    }),
    // Silences a console warning due to amdefine/require, coming through jstransform dependency.
    // In principle jstransform dependency should be eliminated in favor of babel jsx tools (as
    // esprima-fb is deprecated) but in practice VSX transformation relies on the custom
    // modifications of the locally expanded jsx-transform
    new webpack.ContextReplacementPlugin(/source-map/, /$^/),
  ].concat(isLocal ? [] : [
    new UglifyJSPlugin({
      parallel: true,
      sourceMap: !isProduction,
      uglifyOptions: {
        ecma: 5,
        warnings: false,
        parse: {},
        compress: isProduction && {},
        mangle: isProduction && {
          keep_classnames: true,
          keep_fnames: true,
        },
        output: {
          comments: false,
          beautify: false,
        },
        toplevel: false,
        nameCache: null,
        ie8: false,
        safari10: false,
      },
    }),
    new CompressionPlugin({
      asset: "[path].gz[query]",
      algorithm: "gzip",
      test: /\.js$|\.css$|\.html$/,
      threshold: 10240,
      minRatio: 0.8,
    }),
  ]),
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          "style-loader",
          {
            loader: "css-loader",
            options: {
              modules: true,
              importLoaders: 1,
              localIdentName: "[name]__[local]___[hash:base64:5]",
            },
          },
          {
            loader: "postcss-loader",
            options: {
              plugins () { return [autoprefixer({ browsers: ["last 2 versions"] })]; }
            }
          },
        ],
        include: /node_modules/,
      },
    ],
  },
  stats: {},
});
