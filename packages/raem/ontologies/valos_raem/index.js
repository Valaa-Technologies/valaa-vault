module.exports = {
  ...require("./resources"),
  ...require("./events"),

  Verb: { "@type": "valos_kernel:Class",
    "rdfs:subClassOf": "valos_kernel:Property",
    "revdoc:brief": "verb name type",
    "rdfs:comment":
`The class of all verb names. Each context which performs VPath
computation valks provides native implementations for the resolvers
it supports in its VPath valks.
`,
  },

  Resolver: { "@type": "valos_kernel:Class",
    "rdfs:subClassOf": "valos_raem:Verb",
    "revdoc:brief": "resolver verb name type",
    "rdfs:comment":
`The class of all resolver names. Resolvers are verbs which are used
for resolving generated properties.
`,
  },

  ...require("./resolvers"),
};
