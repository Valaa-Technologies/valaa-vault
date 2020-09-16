const { defineNamespace, extendNamespace } = require("@valos/revdoc");

module.exports = {
  ...defineNamespace(require("./VModel")),
  ...defineNamespace(require("./VValk")),
  ...extendNamespace(require("./V")),
};
