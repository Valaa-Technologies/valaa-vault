const extendOntology = require("@valos/vdoc/extendOntology");

module.exports = {
  ...extendOntology(require("./VScript")),
  ...extendOntology(require("./V"), { base: require("~/raem/ontologies").V }),
};
