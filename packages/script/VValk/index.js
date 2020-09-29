module.exports = {
  base: require("@valos/valk/VValk"),
  extenderModule: "@valos/script/VValk",
  namespaceModules: {},
  vocabulary: {
    resolveTwinspace: {
      "@type": "VValk:Resolver",
      "VRevdoc:brief": "resolve twinspace",
      "rdfs:comment": "resolve the twinspace of the ScopeProperty",
    },
    resolveTwinSubject: {
      "@type": "VValk:Resolver",
      "VRevdoc:brief": "resolve reified twin subject",
      "rdfs:comment": "resolve the reified twin subject of the ScopeProperty",
    },
    resolveTwinObject: {
      "@type": "VValk:Resolver",
      "VRevdoc:brief": "resolve reified twin object",
      "rdfs:comment": "resolve the reified twin object of the ScopeProperty",
    },
  },
};
