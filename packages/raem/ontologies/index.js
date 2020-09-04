const extendOntology = require("@valos/vdoc/extendOntology");

module.exports = {
  ...extendOntology(require("./VKernel")),
  ...extendOntology(require("./VValk")),
  ...extendOntology(require("./VModel")),
  ...extendOntology(require("./V")),
};
