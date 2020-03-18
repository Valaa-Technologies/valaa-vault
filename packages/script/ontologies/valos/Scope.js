module.exports = {
  Scope: {
    "@type": "valos_raem:Type",
    "rdfs:subClassOf": ["valos:Resource", "valos:Extant"],
    "revdoc:brief": "property scope interface",
    "rdfs:comment":
`The class of valospace resources which can have scoped properties.`,
  },

  properties: {
    "@type": "valos_raem:EventLoggedField",
    "rdfs:subPropertyOf": "valos:ownlings",
    "rdfs:domain": "valos:Scope",
    "rdfs:range": "rdfs:List",
    "valos_raem:isOwnerOf": true,
    "valos_raem:coupledField": "valos:scope",
    "rdfs:comment":
`The ordered list of ScopeProperty resources of this scope`,
  },
};
