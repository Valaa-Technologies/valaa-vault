module.exports = {
  Sourced: {
    "@type": "valos-raem:Type",
    "rdfs:subClassOf": "valos:Resource",
    "revdoc:brief": "active, visible resource interface",
    "rdfs:comment":
`The class of valospace resources that are sourced in this view of
the world. A sourced resource has all of its fields and properties
available and it can thus be manipulated.`,
  },

  owner: {
    "@type": "valos-raem:PrimaryField",
    "rdfs:domain": "valos:Sourced",
    "rdfs:range": "valos:Sourced",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos-raem:isOwnedBy": true,
    "valos-raem:defaultCoupledField": "valos:ownlings",
    "rdfs:comment":
`The owner of this resource`,
  },

  name: {
    "@type": "valos-raem:PrimaryField",
    "rdfs:domain": "valos:Sourced",
    "rdfs:range": "xsd:string",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "rdfs:comment":
`The primary ValOS name of this resource. It is globally non-unique but
often context-dependently unique.`,
  },

  ownlings: {
    "@type": "valos-raem:PrimaryField",
    "rdfs:domain": "valos:Sourced",
    "rdfs:range": "rdfs:List",
    "valos-raem:isOwnerOf": true,
    "valos-raem:coupledField": "valos:owner",
    "rdfs:comment":
`The ordered list of all resources owned by this resource. This
list is a union of all fields with a valos-raem:isOwnerOf in their
ontology definition.`
  },

  unnamedOwnlings: {
    "@type": "valos-raem:PrimaryField",
    "rdfs:subPropertyOf": "valos:ownlings",
    "rdfs:domain": "valos:Sourced",
    "rdfs:range": "valos:Sourced",
    "valos-raem:isOwnerOf": true,
    "valos-raem:coupledField": "valos:owner",
    "rdfs:comment":
`The ordered list of all resources owned by this resource which are not
contained in another valos-raem:isOwnerOf field list.`,
  },

  isFrozen: {
    "@type": "valos-raem:PrimaryField",
    "rdfs:domain": "valos:Sourced",
    "rdfs:range": "xsd:boolean",
    restriction: { "@type": "owl:Restriction", "owl:cardinality": 1 },
    "valos-raem:isDuplicateable": false,
    "valos-raem:ownDefaultValue": false,
    "rdfs:comment":
`Indicates whether this resource is frozen. A frozen resource nor any
of its ownlings cannot have any of their primary fields be modified.
Setting isFrozen to true is (by design) an irreversible operation.
If this resource is also the root resource of a partition the whole
partition is permanently frozen.`,
  },
};
