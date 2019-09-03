module.exports = {
  Relation: {
    "@type": "valos-raem:Type",
    "rdfs:subClassOf": [
      "valos:Resource", "valos:Sourced",
      "valos:ScriptResource", "valos:Scope", "valos:Relatable",
    ],
    "revdoc:brief": "primary directed relationship edge type",
    "rdfs:comment":
`The class of valospace resources which represent directed,
many-to-many relationships between relatable resources.
With Entity and Media it forms the group of three primary types.
As a Scope it can have scriptable properties. Relation being
a Relatable itself allows for nested and recursive relationship
structures.`,
  },

  source: {
    "@type": "valos-raem:AliasField",
    "valos-raem:aliasOf": "valos:owner",
    "rdfs:subPropertyOf": ["valos:owner", "rdf:source"],
    "rdfs:domain": "valos:Relation",
    "rdfs:range": "valos:Relatable",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos-raem:isOwnedBy": true,
    "valos-raem:coupledField": "valos:relations",
    "rdfs:comment":
`The source (and owner) relatable of this relation.`,
  },

  target: {
    "@type": "valos-raem:PrimaryField",
    "rdfs:subPropertyOf": "rdf:object",
    "rdfs:domain": "valos:Relation",
    "rdfs:range": "valos:Relatable",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos-raem:coupledField": "valos:incomingRelations",
    "rdfs:comment":
`The target relatable of this relation.`,
  },
};
