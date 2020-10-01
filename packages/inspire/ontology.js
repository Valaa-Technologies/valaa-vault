const { specifyNamespace, extendNamespace } = require("@valos/revdoc");

module.exports = {
  ...specifyNamespace(require("./VInspire")),
  ...specifyNamespace(require("./Lens")),
  ...specifyNamespace(require("./VRevela")),
  ...extendNamespace(require("./On")),
};
