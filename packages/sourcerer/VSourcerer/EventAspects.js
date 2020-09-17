module.exports = {
  EventAspect: {
    "@type": "VKernel:Class",
    "VRevdoc:brief": "contextual event aspect",
    "rdfs:comment":
`The class of resources which contain contextual attributes of a
particular event message lifetime phase.`,
  },

  CommandAspect: { "@type": "VKernel:Class",
    "rdfs:subClassOf": "VSourcerer:EventAspect",
    "VRevdoc:brief": "gateway command aspect",
    "rdfs:comment":
`The class of gateway-provided command properties of an event.`,
  },

  LogAspect: { "@type": "VKernel:Class",
    "rdfs:subClassOf": "VSourcerer:EventAspect",
    "VRevdoc:brief": "authority truth aspect",
    "rdfs:comment":
`The class of authority-provided truth properties of an event.`,
  },

  EventAspects: {
    "@type": "VKernel:Class",
    "VRevdoc:brief": "context-free container of event aspects",
    "rdfs:comment":
`The class of resources which provide context-free container of all
different aspects of event message lifetime as it travels through the
ValOS sourcing streams. These properties are grouped to different
contextual and/or functional aspects.`,
  },

  version: {
    "@type": "VKernel:Property",
    "rdfs:domain": "VSourcerer:EventAspects",
    "rdfs:range": "xsd:string",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "rdfs:comment":
`The aspect version string. The version number of this specification is "0.3"`,
  },

  event: {
    "@type": "VKernel:Property",
    "rdfs:domain": "VSourcerer:EventAspects",
    "rdfs:range": "VModel:Event",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "rdfs:comment":
`The aspect which contains the raem model event payload.`,
  },

  command: {
    "@type": "VKernel:Property",
    "rdfs:domain": "VSourcerer:EventAspects",
    "rdfs:range": "VSourcerer:CommandAspect",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "rdfs:comment":
`The aspect which contains the client-generated command properties.`,
  },

  log: {
    "@type": "VKernel:Property",
    "rdfs:domain": "VSourcerer:EventAspects",
    "rdfs:range": "VSourcerer:LogAspect",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "rdfs:comment":
`The aspect which contains the authority-confirmed event log properties.`,
  },
};
