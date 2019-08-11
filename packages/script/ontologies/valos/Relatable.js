module.exports = {
  Relatable: {
    "@type": "valos-raem:Type",
    "rdfs:subClassOf": [
      "valos:Resource", "valos:Sourced",
      "valos:ScriptResource", "valos:Scope"
    ],
    "revdoc:brief": "relation source and/or target interface",
    "rdfs:comment":
`The class of valospace resources which can act as source and target of
a valospace Relation.`,
  },

  relations: {
    "@type": "valos-raem:PrimaryField",
    "rdfs:domain": "valos:Relatable",
    "rdfs:range": "rdfs:List",
    "valos-raem:coupledField": "valos:source",
    "valos-raem:isOwnerOf": true,
    "rdfs:comment":
`The ordered list of outgoing relations of this relatable`,
  },
};
