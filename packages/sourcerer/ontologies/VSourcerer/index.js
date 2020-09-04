module.exports = {
  "@context": {
    VKernel: "https://valospace.org/kernel/0#",
    VModel: "https://valospace.org/raem/0#",
    restriction: { "@reverse": "owl:onProperty" },
    aspects: { "@reverse": "VSourcerer:event" },
  },
  ontology: { "@type": "owl:Ontology",
    "rdfs:label": "VSourcerer",
    "rdf:about": "https://valospace.org/sourcerer/0#",
    "rdfs:comment":
`VSourcerer ontology provides vocabulary for describing and defining
chronicle behaviors and event contents.`,
  },
  ...require("./EventAspects"),
  ...require("./resolvers"),
};
