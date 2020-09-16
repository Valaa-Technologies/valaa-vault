module.exports = {
  domain: "@valos/kernel",
  preferredPrefix: "VScript",
  baseIRI: "https://valospace.org/script/0#",
  namespaceModules: {
    VKernel: "@valos/kernel/VKernel",
    VModel: "@valos/raem/VModel",
    VScript: "@valos/script/VScript",
  },
  description:
`'VScript' namespace specifies the vocabulary for Valoscript execution
primitives.`,
  context: {
    restriction: { "@reverse": "owl:onProperty" },
  },
  vocabulary: {
    resolveTwinspace: {
      "@type": "VModel:Resolver",
      "VRevdoc:brief": "resolve twinspace",
      "rdfs:comment": "resolve the twinspace of the ScopeProperty",
    },
    resolveTwinSubject: {
      "@type": "VModel:Resolver",
      "VRevdoc:brief": "resolve reified twin subject",
      "rdfs:comment": "resolve the reified twin subject of the ScopeProperty",
    },
    resolveTwinObject: {
      "@type": "VModel:Resolver",
      "VRevdoc:brief": "resolve reified twin object",
      "rdfs:comment": "resolve the reified twin object of the ScopeProperty",
    },
  },
};
