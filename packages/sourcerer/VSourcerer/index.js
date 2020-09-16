module.exports = {
  domain: "@valos/kernel",
  preferredPrefix: "VSourcerer",
  baseIRI: "https://valospace.org/sourcerer/0#",
  description:
`'VSourcerer' namespace provides vocabulary for describing and defining
chronicle behaviors and event contents.`,
  namespaceModules: {
    VKernel: "@valos/kernel/VKernel",
    VModel: "@valos/raem/VModel",
    VSourcerer: "@valos/sourcerer/VSourcerer",
  },
  context: {
    restriction: { "@reverse": "owl:onProperty" },
    aspects: { "@reverse": "VSourcerer:event" },
  },
  vocabulary: {
    ...require("./EventAspects"),
    ...require("./resolvers"),
  },
};
