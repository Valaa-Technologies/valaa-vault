module.exports = {
  domain: "@valos/kernel",
  preferredPrefix: "V",
  baseIRI: "https://valospace.org/0#",
  namespaceModules: {
    VKernel: "@valos/kernel/VKernel",
    VState: "@valos/state/VState",
  },
  description:
`The 'V' namespace defines the valospace resource types and fields.`,
  context: {
    restriction: { "@reverse": "owl:onProperty" },
  },
  vocabulary: {},
};
