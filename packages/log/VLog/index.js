module.exports = {
  domain: "@valos/kernel",
  preferredPrefix: "VLog",
  baseIRI: "https://valospace.org/log/0#",
  description:
`The fabric storage and transport layer vocabulary that both specifies
the ValOS event log and aspects structure and is used to express the
content and behaviors of individual chronicles.`,
  namespaceModules: {
    VKernel: "@valos/kernel/VKernel",
    VPlot: "@valos/plot/VPlot",
    VState: "@valos/state/VState",
    VValk: "@valos/valk/VValk",
    V: "@valos/space/V",
  },
  context: {
    restriction: { "@reverse": "owl:onProperty" },
    aspects: { "@reverse": "VLog:event" },
  },
  vocabulary: {
    Event: { "@type": "VKernel:Class",
      "VRevdoc:brief": "chronicle event",
      "rdfs:comment":
`The class of all chronicle event log entries`,
    },
    EventAspects: {
      "@type": "VKernel:Class",
      "VRevdoc:brief": "all the aspects of an event",
      "rdfs:comment":
`The class of resources which contain all different lifecycle aspects
of some chronicle event as it advances through the proclamation
lifecycle.`,
    },
    EventAspect: {
      "@type": "VKernel:Class",
      "VRevdoc:brief": "event lifecycle aspect",
      "rdfs:comment":
`The class of resources which contain a set of attributes of a single
lifecycle aspect of some chronicle event as it progresses through the
proclamation lifecycle.`,
    },
    version: {
      "@type": "VKernel:Property",
      "rdfs:domain": "VLog:EventAspects",
      "rdfs:range": "xsd:string",
      restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
      "rdfs:comment":
`The aspect version string. The version of this specification is "0.3"`,
    },
    ...require("./DeltaAspect"),
    ...require("./CommandAspect"),
    ...require("./LogAspect"),
    ...require("./AuthorAspect"),
  },
};
