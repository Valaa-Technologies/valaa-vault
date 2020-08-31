module.exports = {
  "@context": {
    rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    rdfs: "http://www.w3.org/2000/01/rdf-schema#",
    xsd: "http://www.w3.org/2001/XMLSchema#",
    owl: "http://www.w3.org/2002/07/owl#",
    dc: "http://purl.org/dc/elements/1.1/",
    VKernel: "https://valospace.org/kernel/0#",
    "@base": "https://valospace.org/kernel/0#",
    restriction: { "@reverse": "owl:onProperty" },
  },
  Class: { "@type": "VKernel:Class",
    "rdfs:subClassOf": "rdfs:Class",
    "rdfs:comment":
`The class of classes which are defined by the ValOS kernel domain
ontologies.`,
  },
  Property: { "@type": "VKernel:Class",
    "rdfs:subClassOf": "rdf:Property",
    "rdfs:comment":
`The class of properties which are defined by the ValOS kernel domain
ontologies.`,
  },
};
