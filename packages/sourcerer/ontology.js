const { defineNamespace, extendNamespace } = require("@valos/revdoc");

module.exports = {
  ...defineNamespace(require("./VSourcerer")),
  ...extendNamespace(require("./V")),
};
