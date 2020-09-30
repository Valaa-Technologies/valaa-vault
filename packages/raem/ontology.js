const { specifyNamespace, extendNamespace } = require("@valos/revdoc");

module.exports = {
  ...specifyNamespace(require("./VRaem")),
  ...extendNamespace(require("./VState")),
  ...extendNamespace(require("./VValk")),
  ...extendNamespace(require("./V")),
};
