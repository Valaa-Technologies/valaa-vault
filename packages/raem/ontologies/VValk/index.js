module.exports = {
  "@context": {
    VKernel: "https://valospace.org/kernel/0#",
    VModel: "https://valospace.org/raem/0#",
    restriction: { "@reverse": "owl:onProperty" },
  },
  ontology: { "@type": "owl:Ontology",
    "rdfs:label": "VValk",
    "rdf:about": "https://valospace.org/valk/0#",
    "rdfs:comment":
`VValk ontology provides the vocabulary for VALK, the internal
intermediate interpreted language.`,
  },
  Kuery: { "@type": "VKernel:Class",
    "rdfs:comment":
`The class of resources which represent VALK kueries.`,
  },
};
