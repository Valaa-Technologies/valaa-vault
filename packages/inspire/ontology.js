const { specifyNamespace } = require("@valos/revdoc");

module.exports = {
  ...specifyNamespace(require("./Lens")),
  ...specifyNamespace(require("./On")),
  ...specifyNamespace(require("./VRevela")),
};
