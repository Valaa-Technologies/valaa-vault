module.exports = {
  domain: "@valos/kernel",
  preferredPrefix: "VRevela",
  baseIRI: "https://valospace.org/revela/0#",
  namespaceModules: {
    VKernel: "@valos/kernel/VKernel",
    VPlot: "@valos/plot/VPlot",
    VState: "@valos/state/VState",
    VValk: "@valos/valk/VValk",
  },
  description:
`'VRevela' namespace provides the vocabulary for revela.json
configuration files.`,
  context: {
    restriction: {
      "@reverse": "owl:onProperty",
    },
  },
};
