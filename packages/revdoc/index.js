const vdoc = require("@valos/vdoc");
const extractee = require("./extractee");

module.exports = {
  extension: {
    ...vdoc.extension,
    extends: [vdoc.extension],
    ontology: require("./ontologies").VRevdoc,
    extractors: require("./extractors"),
    emitters: require("./emitters"),
    extractee,
  },
  extractee: {
    ...vdoc.extractee,
    ...extractee,
  },
  ontologyHeaders: require("./ontologyHeaders"),
};
