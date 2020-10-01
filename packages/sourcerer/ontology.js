const { specifyNamespace, extendNamespace } = require("@valos/revdoc");

module.exports = {
  ...specifyNamespace(require("./VSourcerer")),
  ...specifyNamespace(require("./On")),
  ...extendNamespace(require("./VLog")),
  ...extendNamespace(require("./V")),
  ...extendNamespace(require("./VValk")),
};
