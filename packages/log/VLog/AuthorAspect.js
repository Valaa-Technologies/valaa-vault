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
`The index of an antecedent event that this author section chains
against. This usually is the index of the directly preceding event but
if the chronicle allows for reordering and eventual consistency this
can refer to further in the log.`,
  },

  publicIdentity: {
    "@type": "VKernel:Property",
    "rdfs:domain": "VLog:AuthorAspect",
    "rdfs:range": "V:Entity",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "rdfs:comment":
`The public identity resource of the contributor of this author aspect.`,
  },

  signature: {
    "@type": "VKernel:Property",
    "rdfs:domain": "VLog:AuthorAspect",
    "rdfs:range": "xsd:string",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "rdfs:comment":
`A base64-url encoded string containing the 512-bit Ed25519 signature
that is created by tweetnacl.sign.detached when given a VPlot
serialization of '{ command, events }' and the secretKey associated
with the authoring publicIdentity.`,
  },
};
