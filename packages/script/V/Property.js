module.exports = {
  ScopeProperty: {
    "@type": "VState:Type",
    "VRevdoc:brief": "scope property type",
    "rdfs:subClassOf": ["V:Resource", "V:Extant", "rdf:Statement"],
    "rdfs:comment":
`The dominant type class of resources representing properties with a
locally unique name inside an owning Scope namespace resource.

Additionally a ScopeProperty represents the core hypertwin building
block as an rdf:Statement reification of hypertwinned triples.`,
  },

  scope: {
    "@type": "VState:EventLoggedField",
    "rdfs:subPropertyOf": "V:owner",
    "rdfs:domain": "V:ScopeProperty",
    "rdfs:range": "V:Scope",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "VState:isOwnedBy": true,
    "VState:coupledToField": "V:properties",
    "rdfs:comment":
`The scope resource (and owner) of this ScopeProperty.`,
  },

  value: {
    "@type": "VState:EventLoggedField",
    "VState:expressor": ["@$VValk.resolveVPlot@@"],
    "VState:impressor": ["@$VValk.impressViaVPlot@@"],
    "rdfs:domain": "V:ScopeProperty",
    "rdfs:range": ["xsd:string", "VPlot:VPlot"],
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "rdfs:comment":
`The value of this ScopeProperty.`,
  },

  // Hypertwin triple reification

  twinspace: {
    "@type": "VState:GeneratedField",
    "rdfs:domain": "V:ScopeProperty",
    "rdfs:range": "rdfs:Resource",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "VState:expressor": ["@$VValk.resolveTwinspace@@"],
    "rdfs:comment":
`The twinspace of this ScopeProperty. Equates to the expanded prefix
of the V:name of this ScopeProperty using the context of this
chronicle. Additionally if the local part of the V:name is an empty
string then the V:value of this ScopeProperty defines
the twinspace id of the scope resource for this twinspace.`,
  },

  subject: {
    "@type": "VState:GeneratedField",
    "rdfs:subPropertyOf": "rdf:subject",
    "rdfs:domain": "V:ScopeProperty",
    "rdfs:range": "rdfs:Resource",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "VState:expressor": ["@$VValk.resolveTwinSubject@@"],
    "rdfs:comment":
`The subject of this ScopeProperty when interpreted as a reified
rdf:Statement. Equates to the twinspace id of the scope resource using
the V:twinspace of this ScopeProperty.`,
  },

  predicate: {
    "@type": "VState:GeneratedField",
    "rdfs:subPropertyOf": "rdf:predicate",
    "rdfs:domain": "V:ScopeProperty",
    "rdfs:range": "rdfs:Resource",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "VState:expressor": ["@$valos.name@@"],
    "rdfs:comment":
`The predicate of this ScopeProperty when interpreted as a reified
rdf:Statement. Equates to the IRI expansion of V:name of this
ScopeProperty using the context of this chronicle.`,
  },

  object: {
    "@type": "VState:GeneratedField",
    "rdfs:subPropertyOf": "rdf:object",
    "VState:aliasOf": "V:value",
    "rdfs:domain": "V:ScopeProperty",
    "rdfs:range": "rdfs:Resource",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "VState:expressor": ["@$VValk.resolveTwinObject@@"],
    "rdfs:comment":
`The object of this ScopeProperty when interpreted as a reified
rdf:Statement. If the V:value refers to a scope which has this
twinspace id defined (ie. it owns a property with twinspace id as a
name), then this field will be expressed as that twinspace id.
Otherwise equals to the V:value itself.
`,
  },
};
