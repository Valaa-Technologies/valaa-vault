module.exports = {
  domain: "@valos/kernel",
  preferredPrefix: "VScript",
  baseIRI: "https://valospace.org/script/0#",
  namespaceModules: {
    VKernel: "@valos/kernel/VKernel",
    VModel: "@valos/raem/VModel",
    VLog: "@valos/log/VLog",
    VScript: "@valos/script/VScript",
  },
  description:
`'VScript' namespace specifies the vocabulary for Valoscript execution
primitives.`,
  context: {
    restriction: { "@reverse": "owl:onProperty" },
  },
  vocabulary: {},
};
