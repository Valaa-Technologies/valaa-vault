module.exports = {
  ...require("./resources"),
  ...require("./events"),

  Resolver: { "@type": "valos-kernel:Class",
    "rdfs:subClassOf": "rdfs:Class",
    "revdoc:brief": "resolver name tag type",
    "rdfs:comment":
`The class of all resolver name tags. Each context which performs vpath
computation valks provides native implementations for the resolvers
it supports in its vpath valks.
`,
  },

  ...require("./resolvers"),
};
