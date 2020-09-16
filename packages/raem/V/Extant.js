module.exports = {
  Extant: {
    "@type": "VModel:Type",
    "VRevdoc:brief": "extant and present resource interface",
    "rdfs:subClassOf": "V:Resource",
    "rdfs:comment":
`The class of valospace resources that are present and extant in this
view of the world. An extant resource has all of its fields and
properties available and it can thus be manipulated.`,
  },

  owner: {
    "@type": "VModel:EventLoggedField",
    "rdfs:domain": "V:Extant",
    "rdfs:range": "V:Extant",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "VModel:isOwnedBy": true,
    "VModel:defaultCoupledField": "V:ownlings",
    "rdfs:comment":
`The owner of this extant resource.`,
  },

  name: {
    "@type": "VModel:EventLoggedField",
    "VModel:expressor": ["@$VModel.resolveVPath@@"],
    "VModel:impressor": ["@$VModel.impressViaVPath@@"],
    "rdfs:domain": "V:Extant",
    "rdfs:range": ["xsd:string", "VModel:VParam"],
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "rdfs:comment":
`The primary ValOS name of this extant resource. This name is a local
identifier to differentiate the resource from other resources within
the same context. Idiomatically this context is all resources of
a particular type which are owned by the same resource.`,
  },

  inheritancePrototype: {
    "@type": "VModel:EventLoggedField",
    "rdfs:subPropertyOf": "V:prototype",
    "rdfs:domain": "V:Extant",
    "rdfs:range": "V:Resource",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "VModel:coupledField": "V:inheritors",
    "rdfs:comment":
`The inheritance prototype of this extant resource. This represents the
traditional prototypical inheritance where inherited field values are
not remapped in any way.`,
  },

  instancePrototype: {
    "@type": "VModel:EventLoggedField",
    "rdfs:subPropertyOf": "V:prototype",
    "rdfs:domain": "V:Extant",
    "rdfs:range": "V:Resource",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "VModel:coupledField": "V:instances",
    "rdfs:comment":
`The instance prototype of this extant resource. This represents
valos 'ghost instantiation' where all recursively owned resources of
the instancePrototype are also inherited as 'ghosts' under this extant
resource.`,
  },

  ownlings: {
    "@type": "VModel:EventLoggedField",
    "rdfs:domain": "V:Extant",
    "rdfs:range": "rdfs:List",
    "VModel:isOwnerOf": true,
    "VModel:coupledField": "V:owner",
    "rdfs:comment":
`The ordered list of all resources owned by this extant resource. This
list is a union of all fields which define a VModel:isOwnerOf.`
  },

  unnamedOwnlings: {
    "@type": "VModel:EventLoggedField",
    "rdfs:subPropertyOf": "V:ownlings",
    "rdfs:domain": "V:Extant",
    "rdfs:range": "V:Extant",
    "VModel:isOwnerOf": true,
    "VModel:coupledField": "V:owner",
    "rdfs:comment":
`The ordered list of all resources owned by this extant resource which
are not contained in another VModel:isOwnerOf field list.`,
  },

  isFrozen: {
    "@type": "VModel:EventLoggedField",
    "rdfs:domain": "V:Extant",
    "rdfs:range": "xsd:boolean",
    restriction: { "@type": "owl:Restriction", "owl:cardinality": 1 },
    "VModel:isDuplicateable": false,
    "VModel:ownDefaultValue": false,
    "rdfs:comment":
`Indicates whether this extant resource is frozen. A frozen resource
nor any of its ownlings cannot have any of their primary fields be
modified.
Setting isFrozen to true is (by design) an irreversible operation.`,
  },
};
