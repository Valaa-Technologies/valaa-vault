module.exports = {
  DeltaAspect: {
    "@type": "VKernel:Class",
    "VRevdoc:brief": "state delta aspect",
    "rdfs:subClassOf": "VLog:EventAspect",
    "rdfs:comment":
`The class of resources which contain the state delta payload of some
chronicle event.`,
  },

  delta: {
    "@type": "VKernel:Property",
    "rdfs:domain": "VLog:EventAspects",
    "rdfs:range": "VLog:DeltaAspect",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "rdfs:comment":
`The state delta aspect of the event.`,
  },
};
