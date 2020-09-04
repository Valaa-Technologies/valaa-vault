const extendOntology = require("@valos/vdoc/extendOntology");

module.exports = {
  createRemovedFromOntology (preferredPrefix, baseIRI, sourceOntology) {
    const vocabulary = {
      "@context": {
        VKernel: "https://valospace.org/kernel/0#",
        restriction: { "@reverse": "owl:onProperty" },
        ...(sourceOntology || {}).prefixes,
      },
      ontology: { "@type": "owl:Ontology",
        "rdfs:label": preferredPrefix,
        "rdf:about": baseIRI,
        "rdfs:comment":
`${preferredPrefix} removed-from ontology provides vocabulary and
definitions for valospace resource removed-from fields.`
      },
    };
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
    return extendOntology(vocabulary);
  },
};
