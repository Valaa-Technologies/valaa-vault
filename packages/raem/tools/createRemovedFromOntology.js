const { extendOntology } = require("@valos/vdoc");

module.exports = {
  createRemovedFromOntology (prefix, prefixIRI, sourceOntology) {
    const vocabulary = {};
    Object.entries(sourceOntology.vocabulary).forEach(([key, definition]) => {
      if (definition["rdfs:range"] === "rdfs:List"
          && ((definition["@type"] === "valos-raem:EventLoggedField")
              || (definition["@type"] === "valos-raem:CoupledField"))) {
        vocabulary[key] = {
          "@type": "valos-raem:GeneratedField",
          "rdfs:domain": definition["rdfs:domain"],
          "rdfs:range": "rdfs:List",
          "rdfs:comment": `removed-from entries of field ${sourceOntology.prefix}:${key}.`,
        };
      }
    });
    return extendOntology(prefix, prefixIRI, sourceOntology.prefixes, vocabulary);
  },
};
