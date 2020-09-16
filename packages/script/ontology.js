const { defineNamespace, extendNamespace } = require("@valos/revdoc");

module.exports = {
  ...defineNamespace(require("./VScript")),
  ...extendNamespace(require("./V")),
};
