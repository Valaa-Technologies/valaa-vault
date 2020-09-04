module.exports = {
  "@context": {
    VKernel: "https://valospace.org/kernel/0#",
    VModel: "https://valospace.org/raem/0#",
    restriction: { "@reverse": "owl:onProperty" },
  },
  ontology: { "@type": "owl:Ontology",
    "rdfs:label": "VScript",
    "rdf:about": "https://valospace.org/script/0#",
    "rdfs:comment":
`VScript ontology specifies the vocabulary for Valoscript execution
primitives.`,
  },

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
};
