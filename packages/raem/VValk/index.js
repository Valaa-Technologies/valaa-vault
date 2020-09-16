module.exports = {
  domain: "@valos/kernel",
  preferredPrefix: "VValk",
  baseIRI: "https://valospace.org/valk/0#",
  namespaceModules: {
    VKernel: "@valos/kernel/VKernel",
    VModel: "@valos/raem/VModel",
    VValk: "@valos/raem/VValk",
  },
description:
`'VValk' namespace provides the vocabulary for VALK, the internal
intermediate interpreted language.`,
  context: {
    restriction: { "@reverse": "owl:onProperty" },
  },
  vocabulary: {
    Kuery: { "@type": "VKernel:Class",
      "rdfs:comment":
`The class of resources which represent VALK kueries.`,
    },
  },
};
