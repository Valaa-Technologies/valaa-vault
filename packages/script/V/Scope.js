module.exports = {
  Scope: {
    "@type": "VModel:Type",
    "rdfs:subClassOf": ["V:Resource", "V:Extant"],
    "VRevdoc:brief": "property scope interface",
    "rdfs:comment":
`The class of valospace resources which can have scoped properties.`,
  },

  properties: {
    "@type": "VModel:EventLoggedField",
    "rdfs:subPropertyOf": "V:ownlings",
    "rdfs:domain": "V:Scope",
    "rdfs:range": "rdfs:List",
    "VModel:isOwnerOf": true,
    "VModel:coupledField": "V:scope",
    "rdfs:comment":
`The ordered list of ScopeProperty resources of this scope`,
  },
};
