module.exports = {
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

  ...require("./resolvers"),
};
