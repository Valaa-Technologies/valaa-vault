module.exports = {
  Extant: {
    "@type": "valos-raem:Type",
    "revdoc:brief": "extant and present resource interface",
    "rdfs:subClassOf": "valos:Resource",
    "rdfs:comment":
`The class of valospace resources that are present and extant in this
view of the world. An extant resource has all of its fields and
properties available and it can thus be manipulated.`,
  },

  owner: {
    "@type": "valos-raem:EventLoggedField",
    "rdfs:domain": "valos:Extant",
    "rdfs:range": "valos:Extant",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos-raem:isOwnedBy": true,
    "valos-raem:defaultCoupledField": "valos:ownlings",
    "rdfs:comment":
`The owner of this extant resource.`,
  },

  name: {
    "@type": "valos-raem:EventLoggedField",
    "valos-raem:expressor": "$valos-raem:resolveVPath",
    "valos-raem:impressor": "$valos-raem:impressViaVPath",
    "rdfs:domain": "valos:Extant",
    "rdfs:range": ["xsd:string", "valos-raem:VParam"],
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "rdfs:comment":
`The primary ValOS name of this extant resource. This name is a local
identifier to differentiate the resource from other resources within
the same context. Idiomatically this context is all resources of
a particular type which are owned by the same resource.`,
  },

  inheritancePrototype: {
    "@type": "valos-raem:EventLoggedField",
    "rdfs:subPropertyOf": "valos:prototype",
    "rdfs:domain": "valos:Extant",
    "rdfs:range": "valos:Resource",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos-raem:coupledField": "valos:inheritors",
    "rdfs:comment":
`The inheritance prototype of this extant resource. This represents the
traditional prototypical inheritance where inherited field values are
not remapped in any way.`,
  },

  instancePrototype: {
    "@type": "valos-raem:EventLoggedField",
    "rdfs:subPropertyOf": "valos:prototype",
    "rdfs:domain": "valos:Extant",
    "rdfs:range": "valos:Resource",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos-raem:coupledField": "valos:instances",
    "rdfs:comment":
`The instance prototype of this extant resource. This represents
valos 'ghost instantiation' where all recursively owned resources of
the instancePrototype are also inherited as 'ghosts' under this extant
resource.`,
  },

  ownlings: {
    "@type": "valos-raem:EventLoggedField",
    "rdfs:domain": "valos:Extant",
    "rdfs:range": "rdfs:List",
    "valos-raem:isOwnerOf": true,
    "valos-raem:coupledField": "valos:owner",
    "rdfs:comment":
`The ordered list of all resources owned by this extant resource. This
list is a union of all fields with a valos-raem:isOwnerOf in their
ontology definition.`
  },

  unnamedOwnlings: {
    "@type": "valos-raem:EventLoggedField",
    "rdfs:subPropertyOf": "valos:ownlings",
    "rdfs:domain": "valos:Extant",
    "rdfs:range": "valos:Extant",
    "valos-raem:isOwnerOf": true,
    "valos-raem:coupledField": "valos:owner",
    "rdfs:comment":
`The ordered list of all resources owned by this extant resource which
are not contained in another valos-raem:isOwnerOf field list.`,
  },

  isFrozen: {
    "@type": "valos-raem:EventLoggedField",
    "rdfs:domain": "valos:Extant",
    "rdfs:range": "xsd:boolean",
    restriction: { "@type": "owl:Restriction", "owl:cardinality": 1 },
    "valos-raem:isDuplicateable": false,
    "valos-raem:ownDefaultValue": false,
    "rdfs:comment":
`Indicates whether this extant resource is frozen. A frozen resource
nor any of its ownlings cannot have any of their primary fields be
modified.
Setting isFrozen to true is (by design) an irreversible operation.`,
  },
};
