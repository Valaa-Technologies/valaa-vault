module.exports = {
  "@context": {
    rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    rdfs: "http://www.w3.org/2000/01/rdf-schema#",
    xsd: "http://www.w3.org/2001/XMLSchema#",
    owl: "http://www.w3.org/2002/07/owl#",
    dc: "http://purl.org/dc/elements/1.1/",
    valos_kernel: "https://valospace.org/kernel#",
    "@base": "https://valospace.org/kernel#",
    restriction: { "@reverse": "owl:onProperty" },
  },
  Class: { "@type": "valos_kernel:Class",
    "rdfs:subClassOf": "rdfs:Class",
    "rdfs:comment":
`The class of classes which are defined by the ValOS kernel domain
ontologies.`,
  },
  Property: { "@type": "valos_kernel:Class",
    "rdfs:subClassOf": "rdf:Property",
    "rdfs:comment":
`The class of properties which are defined by the ValOS kernel domain
ontologies.`,
  },
};
