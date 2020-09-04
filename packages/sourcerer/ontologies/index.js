const extendOntology = require("@valos/vdoc/extendOntology");

module.exports = {
  ...extendOntology(require("./VSourcerer")),
  ...extendOntology(require("./V"), { base: require("~/raem/ontologies").V }),
};
