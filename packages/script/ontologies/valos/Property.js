module.exports = {
  ScriptProperty: {
    "@type": "valos-raem:Type",
    "rdfs:subClassOf": ["valos:Resource", "valos:Sourced"],
    "revdoc:brief": "valoscript property",
    "rdfs:comment":
`The class of valospace Property resources which are expressed as
valoscript object properties.`,
  },

  scope: {
    "@type": "valos-raem:AliasField",
    "valos-raem:aliasOf": "valos:owner",
    "rdfs:subPropertyOf": "valos:owner",
    "rdfs:domain": "valos:ScriptProperty",
    "rdfs:range": "valos:Scope",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos-raem:isOwnedBy": true,
    "valos-raem:coupledField": "valos:properties",
    "rdfs:comment":
`The scope resource (and owner) of this Property`,
  },

  value: {
    "@type": "valos-raem:PrimaryField",
    "rdfs:domain": "valos:ScriptProperty",
    "rdfs:range": "rdfs:Resource",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos-raem:initialValue": null,
    "valos-raem:finalDefaultValue": ["§void"],
    "rdfs:comment":
`The value of this Property`,
  },
};
