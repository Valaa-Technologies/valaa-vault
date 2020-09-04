module.exports = {
  "@context": {
    VKernel: "https://valospace.org/kernel/0#",
    VModel: "https://valospace.org/raem/0#",
    restriction: { "@reverse": "owl:onProperty" },
  },
  ontology: { "@type": "owl:Ontology",
    "rdfs:label": "V",
    "rdf:about": "https://valospace.org/0#",
    "rdfs:comment":
`Valospace ontology provides vocabulary and definitions of the primary
ValOS resources.`,
  },
  ...require("./Resource"),
  ...require("./Bvob"),
  ...require("./Absent"),
  ...require("./Extant"),
  ...require("./NonExistent"),
};
