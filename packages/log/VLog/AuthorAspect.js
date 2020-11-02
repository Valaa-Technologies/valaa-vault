module.exports = {
  AuthorAspect: {
    "@type": "VKernel:Class",
    "VRevdoc:brief": "command author aspect",
    "rdfs:subClassOf": "VLog:EventAspect",
    "rdfs:comment":
`The class of resources which contain the authoring attributes and the
command signature of a single chronicle event.`,
  },

  author: {
    "@type": "VKernel:Property",
    "rdfs:domain": "VLog:EventAspects",
    "rdfs:range": "VLog:AuthorAspect",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "rdfs:comment":
`The command author aspect of the event.`,
  },

  antecedent: {
    "@type": "VKernel:Property",
    "rdfs:domain": "VLog:AuthorAspect",
    "rdfs:range": "xsd:integer",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "rdfs:comment":
`The index of an antecedent event the payload of which this author
section confirms. This usually is the index of the directly preceding
event but if the chronicle allows for reordering and eventual
consistency this can refer to further in the log.`,
  },

  publicIdentity: {
    "@type": "VKernel:Property",
    "rdfs:domain": "VLog:AuthorAspect",
    "rdfs:range": "V:Entity",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "rdfs:comment":
`The public identity resource of the contributor of this event.`,
  },

  signature: {
    "@type": "VKernel:Property",
    "rdfs:domain": "VLog:AuthorAspect",
    "rdfs:range": "xsd:string",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "rdfs:comment":
`The base64url-encoded 512-bit Ed25519 signature (as provided by
tweetnacl.sign.detached) of the event payload. The exact format of the
payload is pending precise specification. This signature is created
using the secretKey associated with the chronicle publicKey of the
authoring publicIdentity.`,
  },
};
