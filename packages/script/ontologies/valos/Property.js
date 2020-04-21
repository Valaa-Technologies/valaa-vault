module.exports = {
  ScopeProperty: {
    "@type": "valos_raem:Type",
    "revdoc:brief": "scope property type",
    "rdfs:subClassOf": ["valos:Resource", "valos:Extant", "rdf:Statement"],
    "rdfs:comment":
`The dominant type class of resources representing properties with a
locally unique name inside an owning Scope namespace resource.

Additionally a ScopeProperty represents the core hypertwin building
block as an rdf:Statement reification of hypertwinned triples.`,
  },

  scope: {
    "@type": "valos_raem:EventLoggedField",
    "rdfs:subPropertyOf": "valos:owner",
    "rdfs:domain": "valos:ScopeProperty",
    "rdfs:range": "valos:Scope",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos_raem:isOwnedBy": true,
    "valos_raem:coupledField": "valos:properties",
    "rdfs:comment":
`The scope resource (and owner) of this ScopeProperty.`,
  },

  value: {
    "@type": "valos_raem:EventLoggedField",
    "valos_raem:expressor": ["@$valos_raem.resolveVPath@@"],
    "valos_raem:impressor": ["@$valos_raem.impressViaVPath@@"],
    "rdfs:domain": "valos:ScopeProperty",
    "rdfs:range": ["xsd:string", "valos_raem:VPath"],
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "rdfs:comment":
`The value of this ScopeProperty.`,
  },

  // Hypertwin triple reification

  twinspace: {
    "@type": "valos_raem:GeneratedField",
    "rdfs:domain": "valos:ScopeProperty",
    "rdfs:range": "rdfs:Resource",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos_raem:expressor": ["@$valos_script.resolveTwinspace@@"],
    "rdfs:comment":
`The twinspace of this ScopeProperty. Equates to the expanded prefix
of the valos:name of this ScopeProperty using the context of this
chronicle. Additionally if the local part of the valos:name is an empty
string then the valos:value of this ScopeProperty defines
the twinspace id of the scope resource for this twinspace.`,
  },

  subject: {
    "@type": "valos_raem:GeneratedField",
    "rdfs:subPropertyOf": "rdf:subject",
    "rdfs:domain": "valos:ScopeProperty",
    "rdfs:range": "rdfs:Resource",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos_raem:expressor": ["@$valos_script.resolveTwinSubject@@"],
    "rdfs:comment":
`The subject of this ScopeProperty when interpreted as a reified
rdf:Statement. Equates to the twinspace id of the scope resource using
the valos:twinspace of this ScopeProperty.`,
  },

  predicate: {
    "@type": "valos_raem:GeneratedField",
    "rdfs:subPropertyOf": "rdf:predicate",
    "rdfs:domain": "valos:ScopeProperty",
    "rdfs:range": "rdfs:Resource",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos_raem:expressor": ["@$valos.name@@"],
    "rdfs:comment":
`The predicate of this ScopeProperty when interpreted as a reified
rdf:Statement. Equates to the IRI expansion of valos:name of this
ScopeProperty using the context of this chronicle.`,
  },

  object: {
    "@type": "valos_raem:GeneratedField",
    "rdfs:subPropertyOf": "rdf:object",
    "valos_raem:aliasOf": "valos:value",
    "rdfs:domain": "valos:ScopeProperty",
    "rdfs:range": "rdfs:Resource",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos_raem:expressor": ["@$valos_script.resolveTwinObject@@"],
    "rdfs:comment":
`The object of this ScopeProperty when interpreted as a reified
rdf:Statement. If the valos:value refers to a scope which has this
twinspace id defined (ie. it owns a property with twinspace id as a
name), then this field will be expressed as that twinspace id.
Otherwise equals to the valos:value itself.
`,
  },
};
