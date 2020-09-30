module.exports = {
  domain: "@valos/kernel",
  preferredPrefix: "VState",
  baseIRI: "https://valospace.org/state/0#",
  namespaceModules: {
    VKernel: "@valos/kernel/VKernel",
    VPlot: "@valos/plot/VPlot",
    VLog: "@valos/log/VLog",
    VValk: "@valos/valk/VValk",
  },
  description:
`The vocabulary for defining the ValOS state core model and for
extending it with new types and fields.`,
  context: {
    restriction: { "@reverse": "owl:onProperty" },
  },
  vocabulary: {
    Type: { "@type": "VKernel:Class",
      "rdfs:subClassOf": "rdfs:Class",
      "VRevdoc:brief": "valospace type",
      "rdfs:comment": [
`The class of all valospace types. The instances of valospace types
are called valospace resources and are the main valos ecosystem
building block.`,
`Only valospace resources can appear as a subject in valospace resource
and event triple graphs.`,
      ],
    },
    Field: { "@type": "VKernel:Class",
      "rdfs:subClassOf": "rdf:Property",
      "VRevdoc:brief": "valospace field",
      "rdfs:comment": [
`The class of all valospace resource field identifiers.`,
`Only the instances of this class can appear as the predicate in
valospace triple graphs. All valospace fields have VState:Type or one
of its sub-classes as their rdf:domain.`,
      ],
    },
  },
};
