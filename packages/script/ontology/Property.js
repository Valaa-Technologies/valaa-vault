module.exports = {
  ScriptProperty: {
    "@type": "valos:Type",
    "rdfs:subClassOf": ["valos:TransientFields", "valos:Resource"],
    "revdoc:brief": "property",
    "rdfs:comment":
`The class of valospace Property resources which are expressed as
valoscript object properties.`,
  },

  scope: {
    "@type": "valos:AliasField",
    "valos:aliasOf": "valos:owner",
    "rdfs:subPropertyOf": "valos:owner",
    "rdfs:domain": "valos:ScriptProperty",
    "rdfs:range": "valos:Scope",
    "valos:restriction": { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos:isOwned": true,
    "valos:coupledField": "valos:properties",
    "rdfs:comment":
`The scope resource (and owner) of this Property`,
  },

  value: {
    "@type": "valos:PrimaryField",
    "rdfs:domain": "valos:ScriptProperty",
    "rdfs:range": "rdfs:Resource",
    "valos:restriction": { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos:initialValue": null,
    "valos:finalDefaultValue": ["§void"],
    "rdfs:comment":
`The value of this Property`,
  },
};
