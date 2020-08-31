const { extendOntology } = require("@valos/vdoc");

module.exports = {
  createRemovedFromOntology (preferredPrefix, baseIRI, sourceOntology) {
    const vocabulary = {};
    Object.entries((sourceOntology || {}).vocabulary || {}).forEach(([key, definition]) => {
      if (definition["rdfs:range"] === "rdfs:List"
          && ((definition["@type"] === "VModel:EventLoggedField")
              || (definition["@type"] === "VModel:CoupledField"))) {
        vocabulary[key] = {
          "@type": "VModel:GeneratedField",
          "rdfs:domain": definition["rdfs:domain"],
          "rdfs:range": "rdfs:List",
          "rdfs:comment": `removed-from entries of field ${sourceOntology.preferredPrefix}:${key}.`,
        };
      }
    });
    return extendOntology(preferredPrefix, baseIRI, (sourceOntology || {}).prefixes, vocabulary);
  },
};
