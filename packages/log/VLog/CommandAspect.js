module.exports = {
  CommandAspect: {
    "@type": "VKernel:Class",
    "VRevdoc:brief": "command fabrication aspect",
    "rdfs:subClassOf": "VLog:EventAspect",
    "rdfs:comment":
`The class of resources which contain attributes added by a gateway to
some event during the fabrication of the event command.`,
  },

  command: {
    "@type": "VKernel:Property",
    "rdfs:domain": "VLog:EventAspects",
    "rdfs:range": "VLog:CommandAspect",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "rdfs:comment":
`The command fabrication aspect of the event.`,
  },
};
