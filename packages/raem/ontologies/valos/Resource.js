module.exports = {
  Resource: {
    "@type": "valos-raem:Type",
    "rdfs:subClassOf": "rdfs:Resource",
    "revdoc:brief": "valospace resource interface",
    "rdfs:comment":
`The class of resources which can appear as a subject in valospace
resource and event graphs. The domain of all transient and generated
fields which are available even for unsourced bodies.`,
  },

  id: {
    "@type": "valos-raem:GeneratedField",
    "rdfs:domain": "valos:Resource",
    "rdfs:range": "xsd:string",
    restriction: { "@type": "owl:Restriction", "owl:cardinality": 1 },
    "valos-raem:generator": "getId",
    "rdfs:comment":
`The immutable resource id of this resource.`,
  },

  iri: {
    "@type": "valos-raem:GeneratedField",
    "rdfs:domain": "valos:Resource",
    "rdfs:range": "xsd:anyURI",
    restriction: { "@type": "owl:Restriction", "owl:cardinality": 1 },
    "valos-raem:generator": "getIRI",
    "rdfs:comment":
`The authoritative locator IRI of this resource in the current view of
the world. Always equivalent to a catenation of
<valos:partitionIRI> "#" <valos:id>
of this resource`,
  },

  rawId: {
    "@type": "valos-raem:AliasField",
    "revdoc:deprecatedInFavorOf": "valos:id",
    "valos-raem:aliasOf": "valos:id",
    "rdfs:subPropertyOf": "valos:id",
    "rdfs:domain": "valos:Resource",
    "rdfs:range": "xsd:string",
    restriction: { "@type": "owl:Restriction", "owl:cardinality": 1 },
    "valos-raem:generator": "getRawId",
    "rdfs:comment":
`The resource id of this resource`,
  },

  typeName: {
    "@type": "valos-raem:GeneratedField",
    "rdfs:domain": "valos:Resource",
    "rdfs:range": "xsd:string",
    restriction: { "@type": "owl:Restriction", "owl:cardinality": 1 },
    "valos-raem:generator": "getTransientTypeName",
    "rdfs:comment":
`The dominant type name of this resource`,
  },

  partition: {
    "@type": "valos-raem:GeneratedField",
    "rdfs:domain": "valos:Resource",
    "rdfs:range": "valos:Partition",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos-raem:generator": "partitionResolver",
    "rdfs:comment":
`The partition root resource of this resource, ie. the nearest ancestor
(possibly self) with a non-null valos:authorityIRI.`,
  },

  partitionIRI: {
    "@type": "valos-raem:GeneratedField",
    "rdfs:domain": "valos:Resource",
    "rdfs:range": "xsd:anyURI",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos-raem:generator": "partitionURIResolver",
    "rdfs:comment":
`The partition IRI of the partition this resource belongs to in the
current view of the world.`,
  },

  partitionURI: {
    "@type": "valos-raem:AliasField",
    "revdoc:deprecatedInFavorOf": "valos:partitionIRI",
    "valos-raem:aliasOf": "valos:partitionIRI",
    "rdfs:subPropertyOf": "valos:partitionIRI",
    "rdfs:domain": "valos:Resource",
    "rdfs:range": "xsd:anyURI",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
  },

  prototype: {
    "@type": "valos-raem:PrimaryField",
    "rdfs:domain": "valos:Resource",
    "rdfs:range": "valos:Resource",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos-raem:coupledField": "valos:derivations",
    "rdfs:comment":
`The prototype of this resource. All field lookups for which there is
no associated value set and whose field descriptors don't have
ownDefaultValue are forwarded to the prototype.`,
  },

  derivations: {
    "@type": "valos-raem:TransientField",
    "rdfs:domain": "valos:Resource",
    "rdfs:range": "valos:Resource",
    "valos-raem:coupledField": "valos:prototype",
    "valos-raem:preventsDestroy": true,
    "valos-raem:ownDefaultValue": [],
    "rdfs:comment":
`An unordered set of resources which have this resource as their
valos:prototype.`,
  },

  ownFields: {
    "@type": "valos-raem:GeneratedField",
    "rdfs:domain": "valos:Resource",
    "rdfs:range": "valos:Resource",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos-raem:generator": "resolveOwnFields",
    "rdfs:comment":
`A transient version of this object as if prototype was undefined.
All property accesses will only return field values which are directly
owned by this resource.`,
  },

  inheritancePrototype: {
    "@type": "valos-raem:PrimaryField",
    "rdfs:subPropertyOf": "valos:prototype",
    "rdfs:domain": "valos:Resource",
    "rdfs:range": "valos:Resource",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos-raem:coupledField": "valos:inheritors",
    "rdfs:comment":
`The derivation prototype of this resource. This represents the
traditional prototypical inheritance where inherited field values are
not remapped in any way.`,
  },

  inheritors: {
    "@type": "valos-raem:TransientField",
    "rdfs:subPropertyOf": "valos:derivations",
    "rdfs:domain": "valos:Resource",
    "rdfs:range": "valos:Resource",
    "valos-raem:coupledField": "valos:inheritancePrototype",
    "valos-raem:preventsDestroy": true,
    "valos-raem:ownDefaultValue": [],
    "rdfs:comment":
`An unordered set of resources which have this resource as their
valos:inheritancePrototype.`,
  },

  instancePrototype: {
    "@type": "valos-raem:PrimaryField",
    "rdfs:subPropertyOf": "valos:prototype",
    "rdfs:domain": "valos:Resource",
    "rdfs:range": "valos:Resource",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos-raem:coupledField": "valos:instances",
    "rdfs:comment":
`The instance prototype of this resource instance.`,
  },

  instances: {
    "@type": "valos-raem:TransientField",
    "rdfs:subPropertyOf": "valos:derivations",
    "rdfs:domain": "valos:Resource",
    "rdfs:range": "valos:Resource",
    "valos-raem:coupledField": "valos:instancePrototype",
    "valos-raem:preventsDestroy": true,
    "valos-raem:ownDefaultValue": [],
    "rdfs:comment":
`An unordered set of resources which have this resource as their
directvalospace:instancePrototype.`,
  },

  ghostPrototype: {
    "@type": "valos-raem:GeneratedField",
    "rdfs:subPropertyOf": "valos:prototype",
    "rdfs:domain": "valos:Resource",
    "rdfs:range": "valos:Resource",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos-raem:generator": "ghostPrototypeResolver",
    "valos-raem:coupledField": "valos:ghosts",
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

  ghosts: {
    "@type": "valos-raem:TransientField",
    "rdfs:subPropertyOf": "valos:derivations",
    "rdfs:domain": "valos:Resource",
    "rdfs:range": "valos:Resource",
    "valos-raem:coupledField": "valos:ghostPrototype",
    "valos-raem:preventsDestroy": true,
    "valos-raem:ownDefaultValue": [],
    "rdfs:comment":
`An unordered set of all (materialized) ghosts which have this resource
as their valos:ghostPrototype. See @valos/raem#section_ghost_instancing
for why immaterial ghosts are not listed.`,
  },

  materializedGhosts: {
    "@type": "valos-raem:AliasField",
    "revdoc:deprecatedInFavorOf": "valos:ghosts",
    "valos-raem:aliasOf": "valos:ghosts",
    "rdfs:subPropertyOf": "valos:ghosts",
    "rdfs:domain": "valos:Resource",
    "rdfs:range": "valos:Resource",
    "valos-raem:coupledField": "valos:ghostPrototype",
    "valos-raem:preventsDestroy": true,
    "valos-raem:ownDefaultValue": [],
  },

  unnamedCouplings: {
    "@type": "valos-raem:TransientField",
    "rdfs:domain": "valos-raem:TransientField",
    "rdfs:range": "valos-raem:TransientField",
    "valos-raem:coupledField": "",
    "valos-raem:isOwnerOf": true,
    "rdfs:comment":
`Referrers with a missing coupledField referring this resource`,
  },

  ghostHost: {
    "@type": "valos-raem:GeneratedField",
    "rdfs:domain": "valos:Resource",
    "rdfs:range": "valos:Resource",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos-raem:generator": "ghostHostResolver",
    "rdfs:comment":
`The instance resource which brought this ghost into being. This
instance is equivalent to the innermost ancestor of this ghost which is
not a ghost itself.`,
  },

  ghostOwner: {
    "@type": "valos-raem:TransientField",
    "rdfs:domain": "valos:Resource",
    "rdfs:range": "valos:Resource",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos-raem:coupledField": "valos:ghostOwnlings",
    "valos-raem:isOwnedBy": true,
    "valos-raem:ownDefaultValue": null,
    "valos-raem:allowTransientFieldToBeSingular": true,
    "rdfs:comment":
`The instance resource which owns this materialized ghost or null if
this ghost is immaterial.
Note that materialized ghosts will have a two own fields: the
ghostOwner and the regular owner (or one of its aliases). The
removal of either of these owning field relationships will
immaterialize, not destroy, the ghost.`,
  },

  ghostOwnlings: {
    "@type": "valos-raem:TransientField",
    "rdfs:domain": "valos:Resource",
    "rdfs:range": "valos:Resource",
    "valos-raem:isOwnerOf": true,
    "valos-raem:coupledField": "valos:ghostOwner",
    "valos-raem:ownDefaultValue": [],
    "rdfs:comment":
`Materialized ghost resources which have this instance as their ghost
host.`,
  },
};
