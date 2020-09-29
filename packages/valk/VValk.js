module.exports = {
  domain: "@valos/kernel",
  preferredPrefix: "VValk",
  baseIRI: "https://valospace.org/valk/0#",
  namespaceModules: {
    VKernel: "@valos/kernel/VKernel",
    VPlot: "@valos/plot/VPlot",
    VState: "@valos/state/VState",
    VLog: "@valos/log/VLog",
  },
description: `The vocabulary for defining ValOS computations and for
adding defining new semantics to it.`,
  context: {
    restriction: { "@reverse": "owl:onProperty" },
  },
  vocabulary: {
    Kuery: { "@type": "VKernel:Class",
      "rdfs:comment":
`The class of resources which represent VValk kueries.
Deprecation note: VValk kueries and VAKON are an internal
implementation detail. They will be superseded by VPlot-based
computations, which will also be made an externally available.`,
      "VRevdoc:deprecatedInFavorOf": "VPlot:",
    },
    Resolver: { "@type": "VKernel:Class",
      "rdfs:subClassOf": "VPlot:Verb",
      "VRevdoc:brief": "resolver verb name type",
      "rdfs:comment":
`The class of all resolver names. Resolvers are verbs which are used
for resolving generated properties.
`,
    },
    0: {
      "@type": "rdfs:Literal",
      "VRevdoc:brief": "positional argument 0",
      "rdfs:comment": "positional argument 0",
    },
    1: {
      "@type": "rdfs:Literal",
      "VRevdoc:brief": "positional argument 1",
      "rdfs:comment": "positional argument 1",
    },
    2: {
      "@type": "rdfs:Literal",
      "VRevdoc:brief": "positional argument 2",
      "rdfs:comment": "positional argument 2",
    },
    3: {
      "@type": "rdfs:Literal",
      "VRevdoc:brief": "positional argument 3",
      "rdfs:comment": "positional argument 3",
    },
    4: {
      "@type": "rdfs:Literal",
      "VRevdoc:brief": "positional argument 4",
      "rdfs:comment": "positional argument 4",
    },
  },
};
