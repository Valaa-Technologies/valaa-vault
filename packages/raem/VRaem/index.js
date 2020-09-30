module.exports = {
  domain: "@valos/kernel",
  preferredPrefix: "VRaem",
  baseIRI: "https://valospace.org/raem/0#",
  namespaceModules: {
    VKernel: "@valos/kernel/VKernel",
    VState: "@valos/state/VState",
    VLog: "@valos/log/VLog",
    VValk: "@valos/valk/VValk",
  },
  description:
`The 'VRaem' namespace describes the @valos/raem library public API.`,
  context: {
    restriction: { "@reverse": "owl:onProperty" },
  },
  vocabulary: {},
};
