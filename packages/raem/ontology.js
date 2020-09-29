const { specifyNamespace, extendNamespace } = require("@valos/revdoc");

module.exports = {
  ...specifyNamespace(require("./VModel")),
  ...extendNamespace(require("./VValk")),
  ...extendNamespace(require("./V")),
};
