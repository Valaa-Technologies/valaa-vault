module.exports = {
  domain: "@valos/kernel",
  preferredPrefix: "VSourcerer",
  baseIRI: "https://valospace.org/sourcerer/0#",
  namespaceModules: {
    VKernel: "@valos/kernel/VKernel",
    VState: "@valos/state/VState",
    VLog: "@valos/log/VLog",
    VValk: "@valos/valk/VValk",
  },
  description:
`The 'VSourcerer' namespace describes the @valos/sourcerer library public API.`,
  context: {
    restriction: { "@reverse": "owl:onProperty" },
  },
  vocabulary: {},
};
