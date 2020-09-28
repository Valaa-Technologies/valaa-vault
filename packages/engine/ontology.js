const { specifyNamespace, extendNamespace } = require("@valos/revdoc");

module.exports = {
  ...specifyNamespace(require("./VEngine")),
  ...extendNamespace(require("./V")),
};
