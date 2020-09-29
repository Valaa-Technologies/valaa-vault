module.exports = {
  domain: "@valos/kernel",
  preferredPrefix: "VLog",
  baseIRI: "https://valospace.org/log/0#",
  description:
`The vocabulary for defining the ValOS chronicle event log structure
and for adding content and behaviors to it.`,
  namespaceModules: {
    VKernel: "@valos/kernel/VKernel",
    VPlot: "@valos/plot/VPlot",
    VState: "@valos/state/VState",
    VValk: "@valos/valk/VValk",
  },
  context: {
    restriction: { "@reverse": "owl:onProperty" },
    aspects: { "@reverse": "VLog:event" },
  },
  vocabulary: {
    Event: { "@type": "VKernel:Class",
      "VRevdoc:brief": "chronicle event",
      "rdfs:comment":
`The class of all chronicle event log entries`,
    },
    ...require("./events"),
  },
};
