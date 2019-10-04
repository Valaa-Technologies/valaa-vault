module.exports = {
  Scope: {
    "@type": "valos-raem:Type",
    "rdfs:subClassOf": ["valos:Resource", "valos:Extant"],
    "revdoc:brief": "property scope interface",
    "rdfs:comment":
`The class of valospace resources which can have scoped properties.`,
  },

  properties: {
    "@type": "valos-raem:EventLoggedField",
    "rdfs:subPropertyOf": "valos:ownlings",
    "rdfs:domain": "valos:Scope",
    "rdfs:range": "rdfs:List",
    "valos-raem:isOwnerOf": true,
    "valos-raem:coupledField": "valos:scope",
    "rdfs:comment":
`The ordered list of ScopeProperty resources of this scope`,
  },
};
