const { defineNamespace } = require("@valos/revdoc");
const { defineRemovedFromNamespace } = require("@valos/raem/tools/defineRemovedFromNamespace");

const V = defineNamespace(require("./V")).V;

module.exports = {
  ...defineNamespace(require("./VKernel")),
  V,
  ...defineRemovedFromNamespace("VRemovedFrom", "https://valospace.org/removed-from/0#", V),
};
