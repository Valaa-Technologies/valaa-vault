const { specifyNamespace, extendNamespace } = require("@valos/revdoc");

module.exports = {
  ...specifyNamespace(require("./Lens")),
  ...specifyNamespace(require("./Var")),
  ...specifyNamespace(require("./VInspire")),
  ...specifyNamespace(require("./VRevela")),
  ...extendNamespace(require("./On")),
};
