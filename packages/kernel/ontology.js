const { specifyNamespace } = require("@valos/revdoc");
const { defineRemovedFromNamespace } = require("@valos/raem/tools/defineRemovedFromNamespace");

const V = specifyNamespace(require("./V")).V;

module.exports = {
  ...specifyNamespace(require("./VKernel")),
  V,
  ...defineRemovedFromNamespace("VRemovedFrom", "https://valospace.org/removed-from/0#", V),
};
