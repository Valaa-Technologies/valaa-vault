const { defineNamespace } = require("@valos/revdoc");

module.exports = {
  ...defineNamespace(require("./Lens")),
  ...defineNamespace(require("./On")),
  ...defineNamespace(require("./VRevela")),
};
