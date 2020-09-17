module.exports = {
  domain: "@valos/kernel",
  preferredPrefix: "VRevela",
  baseIRI: "https://valospace.org/revela/0#",
  namespaceModules: {
    VKernel: "@valos/kernel/VKernel",
    VModel: "@valos/raem/VModel",
    VRevela: "@valos/inspire/VRevela",
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
