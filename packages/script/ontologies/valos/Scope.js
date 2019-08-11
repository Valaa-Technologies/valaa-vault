module.exports = {
  Scope: {
    "@type": "valos-raem:Type",
    "rdfs:subClassOf": ["valos:Resource"],
    "revdoc:brief": "property namespace interface",
    "rdfs:comment":
`The class of valospace resources which can have valoscript properties.`,
  },

  properties: {
    "@type": "valos-raem:PrimaryField",
    "rdfs:domain": "valos:Scope",
    "rdfs:range": "rdfs:List",
    "valos-raem:coupledField": "valos:scope",
    "valos-raem:isOwnerOf": true,
    "rdfs:comment":
`The ordered list of Property resources of this scope`,
  },
};
