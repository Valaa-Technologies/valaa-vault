const { specifyNamespace, extendNamespace } = require("@valos/revdoc");

module.exports = {
  ...specifyNamespace(require("./VScript")),
  ...extendNamespace(require("./V")),
  ...extendNamespace(require("./VValk")),
};
