const { extendOntology } = require("@valos/vdoc");

module.exports = {
  createRemovedFromOntology (prefix, prefixIRI, sourceOntology) {
    const vocabulary = {};
    Object.entries((sourceOntology || {}).vocabulary || {}).forEach(([key, definition]) => {
      if (definition["rdfs:range"] === "rdfs:List"
          && ((definition["@type"] === "valos_raem:EventLoggedField")
              || (definition["@type"] === "valos_raem:CoupledField"))) {
        vocabulary[key] = {
          "@type": "valos_raem:GeneratedField",
          "rdfs:domain": definition["rdfs:domain"],
          "rdfs:range": "rdfs:List",
          "rdfs:comment": `removed-from entries of field ${sourceOntology.prefix}:${key}.`,
        };
      }
    });
    return extendOntology(prefix, prefixIRI, (sourceOntology || {}).prefixes, vocabulary);
  },
};
