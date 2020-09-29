const { specifyNamespace, extendNamespace } = require("@valos/revdoc");

module.exports = {
  ...specifyNamespace(require("./VSourcerer")),
  ...extendNamespace(require("./V")),
  ...extendNamespace(require("./VValk")),
};
