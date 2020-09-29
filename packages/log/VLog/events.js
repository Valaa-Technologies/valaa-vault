module.exports = {
  EventAspects: {
    "@type": "VKernel:Class",
    "VRevdoc:brief": "context-free container of event aspects",
    "rdfs:comment":
`The class of resources which provide context-free container of all
different lifetime aspects of a single event as it travels through the
ValOS sourcering streams. These properties are grouped to different
contextual and/or functional aspects.`,
  },

  version: {
    "@type": "VKernel:Property",
    "rdfs:domain": "VLog:EventAspects",
    "rdfs:range": "xsd:string",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "rdfs:comment":
`The aspect version string. The version number of this specification is "0.3"`,
  },

  EventAspect: {
    "@type": "VKernel:Class",
    "VRevdoc:brief": "contextual event aspect",
    "rdfs:comment":
`The class of resources which contain contextual attributes of a
particular phase of the event message lifetime.`,
  },

  event: {
    "@type": "VKernel:Property",
    "rdfs:domain": "VLog:EventAspects",
    "rdfs:range": "VLog:Event",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "rdfs:comment":
`The aspect which contains the event state change payload.`,
  },
};
