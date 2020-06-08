const { name } = require("./package");
// This can be customized - now using the package scope as the rootPrefix.
// rootPrefix is used to replace ~ in all imports when assembling packages.
const rootPrefix = name.match(/((.*)\/)?.*/)[2] || "";

module.exports = function configureBabel (api) {
  const shared = require("@valos/type-vault/shared/babel.config")(api, rootPrefix);

  return Object.assign({}, shared, {
  // Add overrides here
  });
};
