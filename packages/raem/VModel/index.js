module.exports = {
  domain: "@valos/kernel",
  preferredPrefix: "VModel",
  baseIRI: "https://valospace.org/raem/0#",
  namespaceModules: {
    VKernel: "@valos/kernel/VKernel",
    VModel: "@valos/raem/VModel",
  },
  description:
`'VModel' ie. Valos Resources and Events Model namespace provides
vocabulary and definitions for the resources that form the fabric of
valospace.`,
  context: {
    restriction: { "@reverse": "owl:onProperty" },
  },
  vocabulary: {
    ...require("./resources"),
    ...require("./events"),

    Verb: { "@type": "VKernel:Class",
      "rdfs:subClassOf": "VKernel:Property",
      "VRevdoc:brief": "verb name type",
      "rdfs:comment":
`The class of all verb names. Each context which performs VPath
computation valks provides native implementations for the resolvers
it supports in its VPath valks.
`,
    },

    Resolver: { "@type": "VKernel:Class",
      "rdfs:subClassOf": "VModel:Verb",
      "VRevdoc:brief": "resolver verb name type",
      "rdfs:comment":
`The class of all resolver names. Resolvers are verbs which are used
for resolving generated properties.
`,
    },

    Event: { "@type": "VKernel:Class",
      "VRevdoc:brief": "chronicle event",
      "rdfs:comment":
`The class of all chronicle event log entries`,
    },

    ...require("./resolvers"),
  },
};
