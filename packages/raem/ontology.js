const { specifyNamespace, extendNamespace } = require("@valos/revdoc");

module.exports = {
  ...specifyNamespace(require("./VModel")),
  ...specifyNamespace(require("./VValk")),
  ...extendNamespace(require("./V")),
};
