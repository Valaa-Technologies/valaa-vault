module.exports = {
  domain: "@valos/kernel",
  preferredPrefix: "VKernel",
  baseIRI: "https://valospace.org/kernel/0#",
  namespaceModules: {
    VKernel: "@valos/kernel/VKernel",
    VPlot: "@valos/plot/VPlot",
    VState: "@valos/state/VState",
    VValk: "@valos/valk/VValk",
    VLog: "@valos/log/VLog",
    VEngine: "@valos/engine/VEngine",
  },
  description:
`The 'VKernel' namespace provides the vocabulary for valos fabric core
concepts and for describing and defining valos ontologies in specific.`,
  context: {
    restriction: { "@reverse": "own:onProperty" },
  },
  vocabulary: {
    Class: { "@type": "rdfs:Class",
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
    Concept: { "@type": "VKernel:Class",
      "rdfs:subClassOf": "rdf:Property",
      "rdfs:comment":
`The class of individuals which represent documentable concepts with
associations to .`,
    },
    API: { "@type": "VKernel:Class",
      "rdfs:subClassOf": "VKernel:Concept",
      "rdfs:comment":
`The class of concepts which represent application programming
interfaces.`,
    },
  },
};
