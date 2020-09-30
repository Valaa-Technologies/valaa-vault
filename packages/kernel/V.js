module.exports = {
  domain: "@valos/kernel",
  preferredPrefix: "V",
  baseIRI: "https://valospace.org/0#",
  namespaceModules: {
    VKernel: "@valos/kernel/VKernel",
    VState: "@valos/state/VState",
  },
  description:
`'V' ie. the Valospace namespace provides vocabulary and definitions of
the primary ValOS resources.`,
  context: {
    restriction: { "@reverse": "owl:onProperty" },
  },
  vocabulary: {},
};
