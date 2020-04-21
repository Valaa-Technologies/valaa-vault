module.exports = {
  Extant: {
    "@type": "valos_raem:Type",
    "revdoc:brief": "extant and present resource interface",
    "rdfs:subClassOf": "valos:Resource",
    "rdfs:comment":
`The class of valospace resources that are present and extant in this
view of the world. An extant resource has all of its fields and
properties available and it can thus be manipulated.`,
  },

  owner: {
    "@type": "valos_raem:EventLoggedField",
    "rdfs:domain": "valos:Extant",
    "rdfs:range": "valos:Extant",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos_raem:isOwnedBy": true,
    "valos_raem:defaultCoupledField": "valos:ownlings",
    "rdfs:comment":
`The owner of this extant resource.`,
  },

  name: {
    "@type": "valos_raem:EventLoggedField",
    "valos_raem:expressor": ["@$valos_raem.resolveVPath@@"],
    "valos_raem:impressor": ["@$valos_raem.impressViaVPath@@"],
    "rdfs:domain": "valos:Extant",
    "rdfs:range": ["xsd:string", "valos_raem:VParam"],
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "rdfs:comment":
`The primary ValOS name of this extant resource. This name is a local
identifier to differentiate the resource from other resources within
the same context. Idiomatically this context is all resources of
a particular type which are owned by the same resource.`,
  },

  inheritancePrototype: {
    "@type": "valos_raem:EventLoggedField",
    "rdfs:subPropertyOf": "valos:prototype",
    "rdfs:domain": "valos:Extant",
    "rdfs:range": "valos:Resource",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos_raem:coupledField": "valos:inheritors",
    "rdfs:comment":
`The inheritance prototype of this extant resource. This represents the
traditional prototypical inheritance where inherited field values are
not remapped in any way.`,
  },

  instancePrototype: {
    "@type": "valos_raem:EventLoggedField",
    "rdfs:subPropertyOf": "valos:prototype",
    "rdfs:domain": "valos:Extant",
    "rdfs:range": "valos:Resource",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos_raem:coupledField": "valos:instances",
    "rdfs:comment":
`The instance prototype of this extant resource. This represents
valos 'ghost instantiation' where all recursively owned resources of
the instancePrototype are also inherited as 'ghosts' under this extant
resource.`,
  },

  ownlings: {
    "@type": "valos_raem:EventLoggedField",
    "rdfs:domain": "valos:Extant",
    "rdfs:range": "rdfs:List",
    "valos_raem:isOwnerOf": true,
    "valos_raem:coupledField": "valos:owner",
    "rdfs:comment":
`The ordered list of all resources owned by this extant resource. This
list is a union of all fields with a valos_raem:isOwnerOf in their
ontology definition.`
  },

  unnamedOwnlings: {
    "@type": "valos_raem:EventLoggedField",
    "rdfs:subPropertyOf": "valos:ownlings",
    "rdfs:domain": "valos:Extant",
    "rdfs:range": "valos:Extant",
    "valos_raem:isOwnerOf": true,
    "valos_raem:coupledField": "valos:owner",
    "rdfs:comment":
`The ordered list of all resources owned by this extant resource which
are not contained in another valos_raem:isOwnerOf field list.`,
  },

  isFrozen: {
    "@type": "valos_raem:EventLoggedField",
    "rdfs:domain": "valos:Extant",
    "rdfs:range": "xsd:boolean",
    restriction: { "@type": "owl:Restriction", "owl:cardinality": 1 },
    "valos_raem:isDuplicateable": false,
    "valos_raem:ownDefaultValue": false,
    "rdfs:comment":
`Indicates whether this extant resource is frozen. A frozen resource
nor any of its ownlings cannot have any of their primary fields be
modified.
Setting isFrozen to true is (by design) an irreversible operation.`,
  },
};
