module.exports = {
  TransientFields: {
    "@type": "valos:Type",
    "rdfs:comment":
`The class of valos resources which are referenced from within this
world and also the domain of all transient and generated fields which
are available even for the inactive, out-of-this-world resources.`,
  },

  id: {
    "@type": "valos:GeneratedField",
    "rdfs:domain": "valos:TransientFields",
    "rdfs:range": "xsd:string",
    "valos:restriction": { "@type": "owl:Restriction", "owl:cardinality": 1 },
    "valos:generator": "getId",
    "rdfs:comment":
`The immutable resource id of this Resource.`,
  },

  rawId: {
    "@type": "valos:AliasField",
    "revdoc:deprecatedInFavorOf": "valos:id",
    "valos:aliasOf": "valos:id",
    "rdfs:subPropertyOf": "valos:id",
    "rdfs:domain": "valos:TransientFields",
    "rdfs:range": "xsd:string",
    "valos:restriction": { "@type": "owl:Restriction", "owl:cardinality": 1 },
    "valos:generator": "getRawId",
    "rdfs:comment":
`The resource id of this Resource`,
  },

  resourceIRI: {
    "@type": "valos:GeneratedField",
    "rdfs:domain": "valos:TransientFields",
    "rdfs:range": "xsd:anyURI",
    "valos:restriction": { "@type": "owl:Restriction", "owl:cardinality": 1 },
    "valos:generator": "getIRI",
    "rdfs:comment":
`The most recent authoritative IRI of this Resource in the current view
of the world. Always equivalent to a catenation of
<valos:partitionIRI> "#" <valos:id>
of this resource`,
  },

  typeName: {
    "@type": "valos:GeneratedField",
    "rdfs:domain": "valos:TransientFields",
    "rdfs:range": "xsd:string",
    "valos:restriction": { "@type": "owl:Restriction", "owl:cardinality": 1 },
    "valos:generator": "getTransientTypeName",
    "rdfs:comment":
`The primary type name of this Resource`,
  },

  partition: {
    "@type": "valos:GeneratedField",
    "rdfs:domain": "valos:TransientFields",
    "rdfs:range": "valos:Partition",
    "valos:restriction": { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos:generator": "partitionResolver",
    "rdfs:comment":
`The partition root Resource of this Resource, ie. the nearest ancestor
(possibly self) with a non-null valos:authorityIRI.`,
  },

  partitionIRI: {
    "@type": "valos:GeneratedField",
    "rdfs:domain": "valos:TransientFields",
    "rdfs:range": "xsd:anyURI",
    "valos:restriction": { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos:generator": "partitionURIResolver",
    "rdfs:comment":
`The partition IRI of the partition this Resource belongs to in the
current view of the world.`,
  },

  partitionURI: {
    "@type": "valos:AliasField",
    "revdoc:deprecatedInFavorOf": "valos:partitionIRI",
    "valos:aliasOf": "valos:partitionIRI",
    "rdfs:subPropertyOf": "valos:partitionIRI",
    "rdfs:domain": "valos:TransientFields",
    "rdfs:range": "xsd:anyURI",
    "valos:restriction": { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
  },

  prototype: {
    "@type": "valos:PrimaryField",
    "rdfs:domain": "valos:TransientFields",
    "rdfs:range": "valos:TransientFields",
    "valos:restriction": { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos:defaultCoupledField": "valos:prototypers",
    "rdfs:comment":
`The prototype of this Resource. All field lookups for which there is
no associated value set and whose field descriptors don't have
ownDefaultValue are forwarded to the prototype.`,
  },

  ownFields: {
    "@type": "valos:GeneratedField",
    "rdfs:domain": "valos:TransientFields",
    "rdfs:range": "valos:TransientFields",
    "valos:restriction": { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos:generator": "resolveOwnFields",
    "rdfs:comment":
`A transient version of this object as if prototype was undefined.
All property accesses will only return field values which are directly
owned by this resource.`,
  },

  prototypers: {
    "@type": "valos:TransientField",
    "rdfs:domain": "valos:TransientFields",
    "rdfs:range": "valos:TransientFields",
    "valos:coupledField": "valos:prototype",
    "valos:preventsDestroy": true,
    "valos:ownDefaultValue": [],
    "rdfs:comment":
`All resources which have this Resource as valos:prototype but not as
valos:instancePrototype nor as valos:ghostPrototype.`,
  },

  instancePrototype: {
    "@type": "valos:AliasField",
    "valos:aliasOf": "valos:prototype",
    "rdfs:subPropertyOf": "valos:prototype",
    "rdfs:domain": "valos:TransientFields",
    "rdfs:range": "valos:TransientFields",
    "valos:restriction": { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos:coupledField": "valos:instances",
    "rdfs:comment":
`The instance prototype of this instance Resource.`,
  },

  instances: {
    "@type": "valos:TransientField",
    "rdfs:domain": "valos:TransientFields",
    "rdfs:range": "valos:TransientFields",
    "valos:coupledField": "valos:prototype",
    "valos:preventsDestroy": true,
    "valos:ownDefaultValue": [],
    "rdfs:comment":
`All resources which have this Resource as their
valos:instancePrototype.`,
  },

  ghostPrototype: {
    "@type": "valos:AliasField",
    "valos:aliasOf": "valos:prototype",
    "rdfs:subPropertyOf": "valos:prototype",
    "rdfs:domain": "valos:TransientFields",
    "rdfs:range": "valos:TransientFields",
    "valos:restriction": { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
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
    "@type": "valos:TransientField",
    "rdfs:domain": "valos:TransientFields",
    "rdfs:range": "valos:TransientFields",
    "valos:coupledField": "valos:prototype",
    "valos:preventsDestroy": true,
    "valos:ownDefaultValue": [],
    "rdfs:comment":
`All materialized ghosts which have this Resource as their
valos:ghostPrototype.`,
  },

  unnamedCouplings: {
    "@type": "valos:TransientField",
    "rdfs:domain": "valos:TransientField",
    "rdfs:range": "valos:TransientField",
    "valos:coupledField": "",
    "valos:isOwning": true,
    "rdfs:comment":
`Referrers with a missing coupledField referring this Resource`,
  },

  ghostHost: {
    "@type": "valos:GeneratedField",
    "rdfs:domain": "valos:TransientFields",
    "rdfs:range": "valos:TransientFields",
    "valos:restriction": { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos:generator": "ghostHostResolver",
    "rdfs:comment":
`If this resource is a ghost this field refers to the innermost
ancestor which is not a ghost, or in other words, the instance that
brought this ghost into being.`,
  },

  ghostOwner: {
    "@type": "valos:TransientField",
    "rdfs:domain": "valos:TransientFields",
    "rdfs:range": "valos:TransientFields",
    "valos:restriction": { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos:coupledField": "valos:ghostOwnlings",
    "valos:isOwned": true,
    "valos:ownDefaultValue": null,
    "valos:allowTransientFieldToBeSingular": true,
    "rdfs:comment":
`Refers to the ghost host of this ghost resource if this ghost is
materialized, otherwise null.
Note that materialized grand-ownling ghosts will have a differing owner
and ghostOwner and that destruction of either of them will result in
immaterialization of the grand-ownling ghost.`,
  },

  ghostOwnlings: {
    "@type": "valos:TransientField",
    "rdfs:domain": "valos:TransientFields",
    "rdfs:range": "valos:TransientFields",
    "valos:isOwning": true, "valos:coupledField": "valos:ghostOwner",
    "valos:ownDefaultValue": [],
    "rdfs:comment":
`Materialized ghost Resource's which have this instance as their ghost
host.`,
  },
};
