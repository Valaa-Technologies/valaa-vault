module.exports = {
  ...require("./resources"),
  ...require("./events"),

  Verb: { "@type": "valos-kernel:Class",
    "rdfs:subClassOf": "valos-kernel:Property",
    "revdoc:brief": "verb name type",
    "rdfs:comment":
`The class of all verb names. Each context which performs vpath
computation valks provides native implementations for the resolvers
it supports in its vpath valks.
`,
  },

  Resolver: { "@type": "valos-kernel:Class",
    "rdfs:subClassOf": "valos-raem:Verb",
    "revdoc:brief": "resolver verb name type",
    "rdfs:comment":
`The class of all resolver names. Resolvers are verbs which are used
for resolving generated properties.
`,
  },

  ...require("./resolvers"),
};
