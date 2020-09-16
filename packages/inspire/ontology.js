const defineValosheathNamespace = require("@valos/engine/valosheath/defineValosheathNamespace");
const { defineNamespace } = require("@valos/revdoc");

module.exports = {
  ...defineValosheathNamespace(require("./Lens")),
  ...defineValosheathNamespace(require("./On")),
  ...defineNamespace(require("./VRevela")),
};
