const { defineNamespace, extendNamespace } = require("@valos/revdoc");

module.exports = {
  ...defineNamespace(require("./VEngine")),
  ...extendNamespace(require("./V")),
};
