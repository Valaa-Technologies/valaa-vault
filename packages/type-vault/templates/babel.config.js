const packageConfig = require("./package");
// This can be customized - now using the package scope as the rootPrefix.
// rootPrefix is used to replace ~ in all imports when assembling packages.
const rootPrefix = packageConfig.name.match(/(.*\/)?.*/)[1] || "";

module.exports = function configureBabel (api) {
  const shared = require("@valos/type-vault/shared/babel.config")(api, rootPrefix);

  return Object.assign({}, shared, {
  // Add overrides and modify typical options:
    ignore: [
      // Never babel dependencies
      "**/node_modules/**/*",
      // Don't babel valma commands
      "**/valma/**/*",
    ],
    babelrcRoots: [
      ".",
      // Resolve nested babel configuration files, merging outer config
      // files on top of inner ones
      "packages/**/*",
    ]
  });
};
