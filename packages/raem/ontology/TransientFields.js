module.exports = {
  TransientFields: {
    "rdf:type": "valos:Type",
    "rdfs:comment":
`The class of valos resources which are referenced from within this
world and also the domain of all transient and generated fields which
are available even for the inactive, out-of-this-world resources.`,
  },

  id: {
    "rdf:type": "valos:GeneratedField",
    "rdfs:domain": "valos:TransientFields",
    "rdfs:range": "rdfs:Resource",
    "valos:propertyRestriction": { "rdf:type": "owl:Restriction", "owl:cardinality": 1 },
    "valos:generator": "getId",
    "rdfs:comment":
`VRL of this Resource`,
  },

  rawId: {
    "rdf:type": "valos:GeneratedField",
    "rdfs:domain": "valos:TransientFields",
    "rdfs:range": "xsd:string",
    "valos:propertyRestriction": { "rdf:type": "owl:Restriction", "owl:cardinality": 1 },
    "valos:generator": "getRawId",
    "rdfs:comment":
`Globally unique identifier of this Resource`,
  },

  typeName: {
    "rdf:type": "valos:GeneratedField",
    "rdfs:domain": "valos:TransientFields",
    "rdfs:range": "xsd:string",
    "valos:propertyRestriction": { "rdf:type": "owl:Restriction", "owl:cardinality": 1 },
    "valos:generator": "getTransientTypeName",
    "rdfs:comment":
`Globally unique identifier of this Resource`,
  },

  partition: {
    "rdf:type": "valos:GeneratedField",
    "rdfs:domain": "valos:TransientFields",
    "rdfs:range": "valos:Partition",
    "valos:propertyRestriction": { "rdf:type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos:generator": "partitionResolver",
    "rdfs:comment":
`The partition root Resource of this Resource, ie. the nearest owner
(possibly self) which is also an active partition.`,
  },

  partitionIRI: {
    "rdf:type": "valos:GeneratedField",
    "rdfs:domain": "valos:TransientFields", "rdfs:range": "rdfs:Resource",
    "valos:propertyRestriction": { "rdf:type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos:generator": "partitionURIResolver",
    "rdfs:comment":
`The partition IRI of the partition this Resource belongs to.`,
  },

  partitionURI: {
    "rdf:type": "valos:AliasField",
    "valos:aliasOf": "valos:partitionIRI",
    "rdfs:subPropertyOf": "valos:partitionIRI",
    "rdfs:domain": "valos:TransientFields",
    "rdfs:range": "rdfs:Resource",
    "valos:propertyRestriction": { "rdf:type": "owl:Restriction", "owl:maxCardinality": 1 },
    "revdoc:deprecatedInFavorOf": "valos:authorityIRI",
  },

  prototype: {
    "rdf:type": "valos:PrimaryField",
    "rdfs:domain": "valos:TransientFields",
    "rdfs:range": "valos:TransientFields",
    "valos:propertyRestriction": { "rdf:type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos:defaultCoupledField": "valos:prototypers",
    "rdfs:comment":
`The prototype of this Resource. All field lookups for which there is
no associated value set and whose field descriptors don't have
immediateDefaultValue are forwarded to the prototype.`,
  },

  prototypeAlias: {
    "rdf:type": "valos:AliasField",
    "valos:aliasOf": "valos:prototype",
    "rdfs:subPropertyOf": "valos:prototype",
    "rdfs:domain": "valos:TransientFields",
    "rdfs:range": "valos:TransientFields",
    "valos:propertyRestriction": { "rdf:type": "owl:Restriction", "owl:maxCardinality": 1 },
    "rdfs:comment":
`The prototype of this Resource.
This is an alias for valos:prototype to bypass conflicts with native
javascript property 'prototype'.`
  },

  ownFields: {
    "rdf:type": "valos:GeneratedField",
    "rdfs:domain": "valos:TransientFields",
    "rdfs:range": "valos:TransientFields",
    "valos:propertyRestriction": { "rdf:type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos:generator": "resolveOwnFields",
    "rdfs:comment":
`A transient version of this object as if prototype was undefined.
All property accesses will only return field values which are directly
owned by this resource.`,
  },

  prototypers: {
    "rdf:type": "valos:TransientField",
    "rdfs:domain": "valos:TransientFields",
    "rdfs:range": "valos:TransientFields",
    "valos:coupledField": "valos:prototype",
    "valos:preventsDestroy": true,
    "valos:immediateDefaultValue": [],
    "rdfs:comment":
`All resources which have this Resource as valos:prototype but not as
valos:instancePrototype nor as valos:ghostPrototype.`,
  },

  instancePrototype: {
    "rdf:type": "valos:AliasField",
    "valos:aliasOf": "valos:prototype",
    "rdfs:subPropertyOf": "valos:prototype",
    "rdfs:domain": "valos:TransientFields",
    "rdfs:range": "valos:TransientFields",
    "valos:propertyRestriction": { "rdf:type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos:coupledField": "valos:instances",
    "rdfs:comment":
`The instance prototype of this instance Resource.`,
  },

  instances: {
    "rdf:type": "valos:TransientField",
    "rdfs:domain": "valos:TransientFields",
    "rdfs:range": "valos:TransientFields",
    "valos:coupledField": "valos:prototype",
    "valos:preventsDestroy": true,
    "valos:immediateDefaultValue": [],
    "rdfs:comment":
`All resources which have this Resource as their
valos:instancePrototype.`,
  },

  ghostPrototype: {
    "rdf:type": "valos:AliasField",
    "valos:aliasOf": "valos:prototype",
    "rdfs:subPropertyOf": "valos:prototype",
    "rdfs:domain": "valos:TransientFields",
    "rdfs:range": "valos:TransientFields",
    "valos:propertyRestriction": { "rdf:type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos:coupledField": "valos:materializedGhosts",
    "rdfs:comment":
`Ghost prototype of this ghost resource. The ghost prototype is the
base resource from which this ghost was created during some primary
instantiation.
This instantiation (which happens on prototype and results in an
instance of it) also ghost-instantiates all the direct and indirect
ownlings of the prototype as ghost ownlings in the instance. The
instance is called the *ghost host* of all these ghosts. Likewise, the
instance prototype is called the ghost host prototype, and the
(grand-)ownlings of this ghost host prototype are the ghost prototypes
of the corresponding ghosts (ie. this field).} .`,
  },

  materializedGhosts: {
    "rdf:type": "valos:TransientField",
    "rdfs:domain": "valos:TransientFields",
    "rdfs:range": "valos:TransientFields",
    "valos:coupledField": "valos:prototype",
    "valos:preventsDestroy": true,
    "valos:immediateDefaultValue": [],
    "rdfs:comment":
`All materialized ghosts which have this Resource as their
valos:ghostPrototype.`,
  },

  unnamedCouplings: {
    "rdf:type": "valos:TransientField",
    "rdfs:domain": "valos:TransientField",
    "rdfs:range": "valos:TransientField",
    "valos:coupledField": "",
    "valos:isOwning": true,
    "rdfs:comment":
`Referrers with a missing coupledField referring this Resource`,
  },

  ghostHost: {
    "rdf:type": "valos:GeneratedField",
    "rdfs:domain": "valos:TransientFields",
    "rdfs:range": "valos:TransientFields",
    "valos:propertyRestriction": { "rdf:type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos:generator": "ghostHostResolver",
    "rdfs:comment":
`The ghost host of this ghost Resource or null if not a ghost. The
ghost host is the innermost direct or indirect non-ghost owner of this
ghost, or in other words the instance that indirectly created this
ghost.`,
  },

  ghostOwner: {
    "rdf:type": "valos:TransientField",
    "rdfs:domain": "valos:TransientFields",
    "rdfs:range": "valos:TransientFields",
    "valos:propertyRestriction": { "rdf:type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos:coupledField": "valos:ghostOwnlings",
    "valos:isOwned": true,
    "valos:immediateDefaultValue": null,
    "valos:allowTransientFieldToBeSingular": true,
    "rdfs:comment":
`Refers to the ghost host of this ghost resource if this ghost is
materialized, otherwise null.
Note that materialized grand-ownling ghosts will have a differing owner
and ghostOwner and that destruction of either of them will result in
immaterialization of the grand-ownling ghost.`,
  },

  ghostOwnlings: {
    "rdf:type": "valos:TransientField",
    "rdfs:domain": "valos:TransientFields",
    "rdfs:range": "valos:TransientFields",
    "valos:isOwning": true, "valos:coupledField": "valos:ghostOwner",
    "valos:immediateDefaultValue": [],
    "rdfs:comment":
`Materialized ghost Resource's which have this instance as their ghost
host.`,
  },
};
