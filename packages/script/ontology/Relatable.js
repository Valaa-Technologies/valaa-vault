module.exports = {
  Relatable: {
    "@type": "valos:Type",
    "rdfs:subClassOf": [
      "valos:TransientFields", "valos:Resource",
      "valos:TransientScriptFields", "valos:Scope"
    ],
    "revdoc:brief": "relatable",
    "rdfs:comment":
`The class of valospace resources which can act as source and target of
a valospace Relation.`,
  },

  relations: {
    "@type": "valos:PrimaryField",
    "rdfs:domain": "valos:Relatable",
    "rdfs:range": "rdfs:List",
    "valos:coupledField": "valos:source",
    "valos:isOwning": true,
    "rdfs:comment":
`The ordered list of outgoing relations of this relatable`,
  },
};
