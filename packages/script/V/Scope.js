module.exports = {
  Scope: {
    "@type": "VState:Type",
    "rdfs:subClassOf": ["V:Resource", "V:Extant"],
    "VRevdoc:brief": "property scope interface",
    "rdfs:comment":
`The class of valospace resources which can have scoped properties.`,
  },

  ownsProperty: {
    "@type": "VState:EventLoggedField",
    "rdfs:subPropertyOf": "V:ownlings",
    "rdfs:domain": "V:Scope",
    "rdfs:range": "rdfs:List",
    "VState:isOwnerOf": true,
    "VState:linkedToField": "V:scope",
    "rdfs:comment":
`The ordered list of ScopeProperty resources of this scope`,
  },
};
