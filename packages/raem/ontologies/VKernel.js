module.exports = {
  "@context": {
    restriction: { "@reverse": "owl:onProperty" },
  },
  ontology: { "@type": "owl:Ontology",
    "rdfs:label": "VKernel",
    "rdf:about": "https://valospace.org/kernel/0#",
    "rdfs:comment":
`VKernel ontology provides the vocabulary for valos fabric core concepts
and for describing and defining valos ontologies in specific.`,
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
  deprecatedInFavorOf: { "@type": "VKernel:Property",
    "rdfs:domain": "rdfs:Resource",
    "rdfs:range": "xsd:string",
    "rdfs:comment":
`The preferred resource in favor of the subject resource.`,
  },
};
