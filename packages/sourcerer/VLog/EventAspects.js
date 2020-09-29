module.exports = {
  CommandAspect: { "@type": "VKernel:Class",
    "rdfs:subClassOf": "VLog:EventAspect",
    "VRevdoc:brief": "gateway command aspect",
    "rdfs:comment":
`The class of gateway-provided command properties of an event.`,
  },

  LogAspect: { "@type": "VKernel:Class",
    "rdfs:subClassOf": "VLog:EventAspect",
    "VRevdoc:brief": "authority truth aspect",
    "rdfs:comment":
`The class of authority-provided truth properties of an event.`,
  },

  command: {
    "@type": "VKernel:Property",
    "rdfs:domain": "VLog:EventAspects",
    "rdfs:range": "VLog:CommandAspect",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "rdfs:comment":
`The aspect which contains the client-generated command properties.`,
  },

  log: {
    "@type": "VKernel:Property",
    "rdfs:domain": "VLog:EventAspects",
    "rdfs:range": "VLog:LogAspect",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "rdfs:comment":
`The aspect which contains the authority-confirmed event log properties.`,
  },
};
