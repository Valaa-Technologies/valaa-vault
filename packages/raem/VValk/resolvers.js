module.exports = {
  resolveVPlot: {
    "@type": "VValk:Resolver",
    "VRevdoc:brief": "resolve VPlot",
    "rdfs:comment": "resolve VPlot",
  },
  impressViaVPlot: {
    "@type": "VValk:Resolver",
    "VRevdoc:brief": "assign via VPlot",
    "rdfs:comment": "assign via VPlot",
  },
  resolveContextTerm: {
    "@type": "VValk:Resolver",
    "VRevdoc:brief": "resolve context term",
    "rdfs:comment": "resolve context term against the event log of the given resource",
  },
  resolveId: {
    "@type": "VValk:Resolver",
    "VRevdoc:brief": "resolve resource id",
    "rdfs:comment": "resolve resource id of the given resource",
  },
  resolveVRIDTransient: {
    "@type": "VValk:Resolver",
    "VRevdoc:brief": "resolve resource VRID object",
    "rdfs:comment": "resolve resource VRID object of the given resource",
  },
  resolveDominantTypeName: {
    "@type": "VValk:Resolver",
    "VRevdoc:brief": "resolve dominant type name",
    "rdfs:comment": "resolve dominant type name of the given resource",
  },
  resolveOwnFieldsTransient: {
    "@type": "VValk:Resolver",
    "VRevdoc:brief": "resolve only owns-fields transient",
    "rdfs:comment": "resolve only owns-fields-only transient of this resource",
  },
  resolveGhostPrototype: {
    "@type": "VValk:Resolver",
    "VRevdoc:brief": "resolve ghost prototype",
    "rdfs:comment": "resolve the ghost prototype of this ghost",
  },
  resolveGhostHost: {
    "@type": "VValk:Resolver",
    "VRevdoc:brief": "resolve ghost host",
    "rdfs:comment": "resolve the ghost host of this ghost",
  },
  resolveContentLength: {
    "@type": "VValk:Resolver",
    "VRevdoc:brief": "resolve Bvob octet count",
    "rdfs:comment": "resolve octet count of the octet-stream associated with the Bvob",
  },
};
