module.exports = {
  ontology: {
    "@context": {
      VKernel: "https://valospace.org/kernel/0#",
      restriction: { "@reverse": "owl:onProperty" },
    },
    ontology: { "@type": "owl:Ontology",
      "rdfs:label": "VRevela",
      "rdf:about": "https://valospace.org/revela/0#",
      "rdfs:comment":
`VRevela ontology provides the vocabulary for revela.json configuration files.`,
    },
  },
};
