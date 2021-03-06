module.exports = {
  Extant: {
    "@type": "VState:Type",
    "VRevdoc:brief": "extant and present resource interface",
    "rdfs:subClassOf": "V:Resource",
    "rdfs:comment":
`The class of valospace resources that are present and extant in this
view of the world. An extant resource has all of its fields and
properties available and it can thus be manipulated.`,
  },

  owner: {
    "@type": "VState:EventLoggedField",
    "rdfs:domain": "V:Extant",
    "rdfs:range": "V:Extant",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "VState:isOwnedBy": true,
    "VState:defaultCoupledField": "V:ownlings",
    "rdfs:comment":
`The owner of this extant resource.`,
  },

  name: {
    "@type": "VState:EventLoggedField",
    "VState:expressor": ["@$VValk.resolveVPlot@@"],
    "VState:impressor": ["@$VValk.impressViaVPlot@@"],
    "rdfs:domain": "V:Extant",
    "rdfs:range": ["xsd:string", "VPlot:VParam"],
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "rdfs:comment":
`The primary ValOS name of this extant resource. This name is a local
identifier to differentiate the resource from other resources within
the same context. Idiomatically this context is all resources of
a particular type which are owned by the same resource.`,
  },

  hasPrototype: {
    "@type": "VState:EventLoggedField",
    "rdfs:subPropertyOf": "V:specializationOf",
    "rdfs:domain": "V:Extant",
    "rdfs:range": "V:Resource",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "VState:coupledToField": "V:prototypeOf",
    "rdfs:comment":
`The prototype of this extant resource. This represents the
traditional prototypical inheritance where inherited field values are
not remapped in any way.`,
  },

  instanceOf: {
    "@type": "VState:EventLoggedField",
    "rdfs:subPropertyOf": "V:specializationOf",
    "rdfs:domain": "V:Extant",
    "rdfs:range": "V:Resource",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "VState:coupledToField": "V:hasInstance",
    "rdfs:comment":
`The instance prototype of this extant resource. This represents valos
'ghost instantiation' where all recursively owned resources of the
instanceOf are also inherited as 'ghosts' under this extant resource.`,
  },

  ownlings: {
    "@type": "VState:EventLoggedField",
    "rdfs:domain": "V:Extant",
    "rdfs:range": "rdfs:List",
    "VState:isOwnerOf": true,
    "VState:linkedToField": "V:owner",
    "rdfs:comment":
`The ordered list of all resources owned by this extant resource. This
list is a union of all fields which define a VState:isOwnerOf.`
  },

  unnamedOwnlings: {
    "@type": "VState:EventLoggedField",
    "rdfs:subPropertyOf": "V:ownlings",
    "rdfs:domain": "V:Extant",
    "rdfs:range": "V:Extant",
    "VState:isOwnerOf": true,
    "VState:linkedToField": "V:owner",
    "rdfs:comment":
`The ordered list of all resources owned by this extant resource which
are not contained in another VState:isOwnerOf field list.`,
  },

  isFrozen: {
    "@type": "VState:EventLoggedField",
    "rdfs:domain": "V:Extant",
    "rdfs:range": "xsd:boolean",
    restriction: { "@type": "owl:Restriction", "owl:cardinality": 1 },
    "VState:isDuplicateable": false,
    "VState:ownDefaultValue": false,
    "rdfs:comment":
`Indicates whether this extant resource is frozen. A frozen resource
nor any of its ownlings cannot have any of their primary fields be
modified.
Setting isFrozen to true is (by design) an irreversible operation.`,
  },
};
