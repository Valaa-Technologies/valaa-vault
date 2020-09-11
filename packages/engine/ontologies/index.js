const extendOntology = require("@valos/vdoc/extendOntology");

module.exports = {
  ...extendOntology(require("./VEngine")),
  ...extendOntology(require("./V"), { base: require("@valos/sourcerer/ontologies").V }),
};
