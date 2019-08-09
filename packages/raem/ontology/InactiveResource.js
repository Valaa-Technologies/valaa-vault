module.exports = {
  InactiveResource: {
    "@type": "valos:Type",
    "rdfs:subClassOf": "valos:TransientFields",
    "revdoc:brief": "inactive resource",
    "rdfs:comment":
`An InactiveResource is a Resource whose partition has not yet been
fully loaded, and has only the limited set of fields of TransientFields
available. The transition from InactiveResource to and from other
concrete Resource types is the only possible runtime type change and
happens dynamically based on the partition activation and inactivation.`,
  },
};
