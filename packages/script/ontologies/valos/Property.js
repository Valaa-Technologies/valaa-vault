module.exports = {
  ScopeProperty: {
    "@type": "valos-raem:Type",
    "rdfs:subClassOf": ["valos:Resource", "valos:Sourced", "rdf:Statement"],
    "revdoc:brief": "valoscript property",
    "rdfs:comment":
`The class of valospace Property resources which belong to a scope.`,
  },

  scope: {
    "@type": "valos-raem:AliasField",
    "valos-raem:aliasOf": "valos:owner",
    "rdfs:subPropertyOf": "valos:owner",
    "rdfs:domain": "valos:ScopeProperty",
    "rdfs:range": "valos:Scope",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos-raem:isOwnedBy": true,
    "valos-raem:coupledField": "valos:properties",
    "rdfs:comment":
`The scope resource (and owner) of this ScopeProperty`,
  },

  value: {
    "@type": "valos-raem:PrimaryField",
    "rdfs:domain": "valos:ScopeProperty",
    "rdfs:range": "rdfs:Resource",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos-raem:initialValue": null,
    "valos-raem:finalDefaultValue": ["§void"],
    "rdfs:comment":
`The value of this ScopeProperty`,
  },

  // Hypertwin triple reification

  twinspace: {
    "@type": "valos-raem:GeneratedField",
    "rdfs:domain": "valos:ScopeProperty",
    "rdfs:range": "rdfs:Resource",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos-raem:generator": "getTwinspace",
    "rdfs:comment":
`The twinspace of this ScopeProperty. Equates to the expanded prefix
of the valos:name of this ScopeProperty using the context of this
partition. Additionally if the local part of the valos:name is an empty
string then the valos:value of this ScopeProperty defines
the twinspace id of the scope resource for this twinspace.`,
  },

  subject: {
    "@type": "valos-raem:GeneratedField",
    "rdfs:subPropertyOf": "rdf:subject",
    "rdfs:domain": "valos:ScopeProperty",
    "rdfs:range": "rdfs:Resource",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos-raem:generator": "getSubject",
    "rdfs:comment":
`The subject of this ScopeProperty when interpreted as a reified
rdf:Statement. Equates to the twinspace id of the scope resource using
the valos:twinspace of this ScopeProperty.`,
  },

  predicate: {
    "@type": "valos-raem:GeneratedField",
    "rdfs:subPropertyOf": "rdf:predicate",
    "rdfs:domain": "valos:ScopeProperty",
    "rdfs:range": "rdfs:Resource",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos-raem:generator": "getPredicate",
    "rdfs:comment":
`The subject of this ScopeProperty when interpreted as a reified
rdf:Statement. Equates to the IRI expansion of valos:name of this
ScopeProperty using the context of this partition.`,
  },

  object: {
    "@type": "valos-raem:AliasField",
    "valos-raem:aliasOf": "valos:value",
    "rdfs:subPropertyOf": "rdf:object",
    "rdfs:domain": "valos:ScopeProperty",
    "rdfs:range": "rdfs:Resource",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "rdfs:comment":
`The subject of this ScopeProperty when interpreted as a reified
rdf:Statement. Equates to the twinspace id of the valos:value using
the valos:twinspace of this ScopeProperty if one is defined. Otherwise
equals to the valos:value itself.
`,
  },
};
