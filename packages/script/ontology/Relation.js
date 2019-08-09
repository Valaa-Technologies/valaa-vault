module.exports = {
  Relation: {
    "@type": "valos:Type",
    "rdfs:subClassOf": [
      "valos:TransientFields", "valos:Resource",
      "valos:TransientScriptFields", "valos:Scope", "valos:Relatable",
    ],
    "revdoc:brief": "relation",
    "rdfs:comment":
`The class of valospace resources which can act as source and target of
a valospace Relation.`,
  },

  /*
  owner: {
    "@type": "valos:PrimaryField",
    "rdfs:domain": "valos:Relation",
    "rdfs:range": "valos:Relatable",
    "valos:restriction": { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos:isOwned": true,
    "valos:defaultCoupledField": "valos:relations",
    "rdfs:comment":
`The owner of this Property`,
  },
  */

  source: {
    "@type": "valos:AliasField",
    "valos:aliasOf": "valos:owner",
    "rdfs:subPropertyOf": "valos:owner",
    "rdfs:domain": "valos:Relation",
    "rdfs:range": "valos:Relatable",
    "valos:restriction": { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos:isOwned": true,
    "valos:coupledField": "valos:relations",
    "rdfs:comment":
`The source (and owner) relatable of this relation.`,
  },

  target: {
    "@type": "valos:PrimaryField",
    "rdfs:domain": "valos:Relation",
    "rdfs:range": "valos:Relatable",
    "valos:restriction": { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos:coupledField": "valos:incomingRelations",
    "rdfs:comment":
`The target relatable of this relation.`,
  },
};
