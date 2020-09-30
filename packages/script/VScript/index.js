module.exports = {
  domain: "@valos/kernel",
  preferredPrefix: "VScript",
  baseIRI: "https://valospace.org/script/0#",
  namespaceModules: {
    VKernel: "@valos/kernel/VKernel",
    VState: "@valos/state/VState",
    VLog: "@valos/log/VLog",
    VValk: "@valos/valk/VValk",
  },
  description:
`The 'VScript' namespace describes the @valos/sourcerer API.`,
  context: {
    restriction: { "@reverse": "owl:onProperty" },
  },
  vocabulary: {},
};
