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

    globalResources: {
      "@type": "VKernel:Property",
      "rdfs:domain": "rdfs:Resource",
      "rdfs:range": "rdfs:Resource",
      "rdfs:comment":
`This field refers to all resources that are global resources of a
particular chronicle.`,
    },

    subResources: {
      "@type": "VKernel:Property",
      "rdfs:domain": "rdfs:Resource",
      "rdfs:range": "rdfs:Resource",
      "rdfs:comment":
`This field refers to all resources that are added as sub-resources to
this resource.`,
    },

    removes: {
      "@type": "VKernel:Property",
      "rdfs:domain": "rdfs:Resource",
      "rdfs:range": "rdfs:Resource",
      "rdfs:comment":
`This field refers to graph which contains triples that are to be
removed from this resource. When this field is expressed in state
graphs this removal affects triples that would be inferred from
ownership and instancing projections. When this field is expressed in
log delta graphs the removal represents state triple removal change
and takes effect during the delta application.`,
    },
  },
};
