module.exports = {
  LogAspect: {
    "@type": "VKernel:Class",
    "rdfs:subClassOf": "VLog:EventAspect",
    "VRevdoc:brief": "authority log aspect",
    "rdfs:comment":
`The class of resources which contain attributes added by an authority
to some event when the event is added to the authority chronicle event
log.`,
  },

  log: {
    "@type": "VKernel:Property",
    "rdfs:domain": "VLog:EventAspects",
    "rdfs:range": "VLog:LogAspect",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "rdfs:comment":
`The authority log aspect of the event.`,
  },
};
