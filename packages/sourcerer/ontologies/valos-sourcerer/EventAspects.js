module.exports = {
  EventAspect: {
    "@type": "valos-kernel:Class",
    "revdoc:brief": "contextual event aspect",
    "rdfs:comment":
`The class of resources which contain contextual attributes of a
particular event message lifetime phase.`,
  },

  EventAspects: {
    "@type": "valos-kernel:Class",
    "revdoc:brief": "context-free container of event aspects",
    "rdfs:comment":
`The class of resources which provide context-free container of all
different aspects of event message lifetime as it travels through the
ValOS sourcing streams. These properties are grouped to different
contextual and/or functional aspects.`,
  },

  version: {
    "@type": "valos-kernel:Property",
    "rdfs:domain": "valos-sourcerer:EventAspects",
    "rdfs:range": "xsd:string",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "rdfs:comment":
`The aspect version string. The version number of this specification is "0.3"`,
  },

  event: {
    "@type": "valos-kernel:Property",
    "rdfs:domain": "valos-sourcerer:EventAspects",
    "rdfs:range": "valos-raem:Event",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "rdfs:comment":
`The aspect which contains the raem model event payload.`,
  },

  command: {
    "@type": "valos-kernel:Property",
    "rdfs:domain": "valos-sourcerer:EventAspects",
    "rdfs:range": "valos-sourcerer:CommandAspect",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "rdfs:comment":
`The aspect which contains the client-generated command properties.`,
  },

  log: {
    "@type": "valos-kernel:Property",
    "rdfs:domain": "valos-sourcerer:EventAspects",
    "rdfs:range": "valos-sourcerer:LogAspect",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "rdfs:comment":
`The aspect which contains the authority-confirmed event log properties.`,
  },
};
