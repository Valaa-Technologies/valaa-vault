module.exports = {
  Scope: {
    "@type": "valos:Type",
    "rdfs:subClassOf": ["valos:TransientFields"],
    "revdoc:brief": "scope",
    "rdfs:comment":
`The class of valospace resources which can have valospace script
properties.`,
  },

  properties: {
    "@type": "valos:PrimaryField",
    "rdfs:domain": "valos:Scope",
    "rdfs:range": "rdfs:List",
    "valos:coupledField": "valos:scope",
    "valos:isOwning": true,
    "rdfs:comment":
`The ordered list of Property resources of this scope`,
  },
};
