module.exports = {
  ChangeAspect: {
    "@type": "VKernel:Class",
    "VRevdoc:brief": "state change aspect",
    "rdfs:subClassOf": "VLog:EventAspect",
    "rdfs:comment":
`The class of resources which contain the state change payload of a
some chronicle event.`,
  },

  change: {
    "@type": "VKernel:Property",
    "rdfs:domain": "VLog:EventAspects",
    "rdfs:range": "VLog:ChangeAspect",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "rdfs:comment":
`The state change aspect of the event.`,
  },
};
