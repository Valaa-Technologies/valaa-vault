const extendOntology = require("@valos/vdoc/extendOntology");

module.exports = {
  ...extendOntology(require("./Lens").ontology),
  ...extendOntology(require("./On").ontology),
  ...extendOntology(require("./revela").ontology),
};
