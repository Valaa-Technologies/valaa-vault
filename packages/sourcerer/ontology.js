const { extendNamespace } = require("@valos/revdoc");

module.exports = {
  ...extendNamespace(require("./VLog")),
  ...extendNamespace(require("./V")),
  ...extendNamespace(require("./VValk")),
};
