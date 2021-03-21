module.exports = {
  LogAspect: {
    "@type": "VKernel:Class",
    "rdfs:subClassOf": "VLog:EventAspect",
    "VRevdoc:brief": "event log aspect",
    "rdfs:comment":
`The class of resources which contain attributes of an event which
relate to its position in the chronicle event log. The contents of this
aspect are ultimately determined by the authority but is typically
provisionally provided by the gateway.`,
  },

  log: {
    "@type": "VKernel:Property",
    "rdfs:domain": "VLog:EventAspects",
    "rdfs:range": "VLog:LogAspect",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "rdfs:comment":
`The authority log aspect of the event.`,
  },

  index: {
    "@type": "VKernel:Property",
    "rdfs:domain": "VLog:LogAspect",
    "rdfs:range": "xsd:integer",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "rdfs:comment":
`The 0-based index of the event in the chronicle event log.`,
  },

  vplotHashV0: {
    "@type": "VKernel:Property",
    "rdfs:domain": "VLog:LogAspect",
    "rdfs:range": "xsd:string",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "rdfs:comment":
`The base64url-encoded SHA-512/384 hash of the combination of the
preceding event vplotHashV0 with the current event signature or delta.
The exact format of the combination is pending. The event contents is
defined to be the VLog:signature if the event is signed, otherwise it
is the vplot serialization of the VLog:DeltaAspect of the event.`,
  },
};
