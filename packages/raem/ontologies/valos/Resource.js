module.exports = {
  Resource: {
    "@type": "valos_raem:Type",
    "revdoc:brief": "base resource interface",
    "rdfs:subClassOf": "rdfs:Resource",
    "rdfs:comment":
`The class of resources which can appear as a subject in valospace
resource and event graphs. The domain of all transient and generated
fields which are available even for unsourced bodies.`,
  },

  id: {
    "@type": "valos_raem:GeneratedField",
    "rdfs:domain": "valos:Resource",
    "rdfs:range": "xsd:string",
    restriction: { "@type": "owl:Restriction", "owl:cardinality": 1 },
    "valos_raem:expressor": ["@$valos_raem.resolveId@@"],
    "rdfs:comment":
`The immutable string representation of the VRID of this resource.`,
  },

  rawId: {
    "@type": "valos_raem:AliasField",
    "revdoc:deprecatedInFavorOf": "valos:id",
    "valos_raem:aliasOf": "valos:id",
    "rdfs:subPropertyOf": "valos:id",
    "rdfs:domain": "valos:Resource",
    "rdfs:range": "xsd:string",
    restriction: { "@type": "owl:Restriction", "owl:cardinality": 1 },
    "rdfs:comment":
`The immutable string representation of the VRID of this resource.`,
  },

  vrid: {
    "@type": "valos_raem:TransientField",
    "rdfs:domain": "valos:Resource",
    "rdfs:range": "rdfs:List",
    restriction: { "@type": "owl:Restriction", "owl:cardinality": 1 },
    "valos_raem:expressor": ["@$valos_raem.resolveVRIDTransient@@"],
    "rdfs:comment":
`The immutable, segmented object representation of the VRID of this
resource.`,
  },

  typeName: {
    "@type": "valos_raem:GeneratedField",
    "rdfs:domain": "valos:Resource",
    "rdfs:range": "xsd:string",
    restriction: { "@type": "owl:Restriction", "owl:cardinality": 1 },
    "valos_raem:expressor": ["@$valos_raem.resolveDominantTypeName@@"],
    "rdfs:comment":
`The dominant type name of this resource`,
  },

  prototype: {
    "@type": "valos_raem:EventLoggedField",
    "rdfs:domain": "valos:Resource",
    "rdfs:range": "valos:Resource",
    "valos_raem:coupledField": "valos:derivations",
    "rdfs:comment":
`The prototypes of this resource. All field lookups for which there is
no associated value set and whose field descriptors don't have
ownDefaultValue are forwarded to the prototype.`,
  },

  derivations: {
    "@type": "valos_raem:CoupledField",
    "rdfs:domain": "valos:Resource",
    "rdfs:range": "valos:Resource",
    "valos_raem:coupledField": "valos:prototype",
    "valos_raem:preventsDestroy": true,
    "valos_raem:ownDefaultValue": [],
    "rdfs:comment":
`An unordered set of resources which have this resource as their
valos:prototype.`,
  },

  ownFields: {
    "@type": "valos_raem:TransientField",
    "rdfs:domain": "valos:Resource",
    "rdfs:range": "valos:Resource",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos_raem:expressor": ["@$valos_raem.resolveOwnFieldsTransient@@"],
    "rdfs:comment":
`A transient version of this object as if prototype was undefined.
All property accesses will only return field values which are directly
owned by this resource.`,
  },

  inheritors: {
    "@type": "valos_raem:CoupledField",
    "rdfs:subPropertyOf": "valos:derivations",
    "rdfs:domain": "valos:Resource",
    "rdfs:range": "valos:Resource",
    "valos_raem:coupledField": "valos:inheritancePrototype",
    "valos_raem:preventsDestroy": true,
    "valos_raem:ownDefaultValue": [],
    "rdfs:comment":
`An unordered set of resources which have this resource as their
valos:inheritancePrototype.`,
  },

  instances: {
    "@type": "valos_raem:CoupledField",
    "rdfs:subPropertyOf": "valos:derivations",
    "rdfs:domain": "valos:Resource",
    "rdfs:range": "valos:Resource",
    "valos_raem:coupledField": "valos:instancePrototype",
    "valos_raem:preventsDestroy": true,
    "valos_raem:ownDefaultValue": [],
    "rdfs:comment":
`An unordered set of resources which have this resource as their
direct valos:instancePrototype.`,
  },

  ghostPrototype: {
    "@type": "valos_raem:GeneratedField",
    "rdfs:subPropertyOf": "valos:prototype",
    "rdfs:domain": "valos:Resource",
    "rdfs:range": "valos:Resource",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos_raem:expressor": ["@$valos_raem.resolveGhostPrototype@@"],
    "valos_raem:coupledField": "valos:ghosts",
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
    "@type": "valos_raem:CoupledField",
    "rdfs:subPropertyOf": "valos:derivations",
    "rdfs:domain": "valos:Resource",
    "rdfs:range": "valos:Resource",
    "valos_raem:coupledField": "valos:ghostPrototype",
    "valos_raem:preventsDestroy": true,
    "valos_raem:ownDefaultValue": [],
    "rdfs:comment":
`An unordered set of all (materialized) ghosts which have this resource
as their valos:ghostPrototype. See @valos/raem#section_ghost_instancing
for why immaterial ghosts are not listed.`,
  },

  materializedGhosts: {
    "@type": "valos_raem:AliasField",
    "revdoc:deprecatedInFavorOf": "valos:ghosts",
    "valos_raem:aliasOf": "valos:ghosts",
    "rdfs:subPropertyOf": "valos:ghosts",
    "rdfs:domain": "valos:Resource",
    "rdfs:range": "valos:Resource",
    "valos_raem:coupledField": "valos:ghostPrototype",
    "valos_raem:preventsDestroy": true,
    "valos_raem:ownDefaultValue": [],
  },

  unnamedCouplings: {
    "@type": "valos_raem:CoupledField",
    "rdfs:domain": "valos:Resource",
    "rdfs:range": "valos:Resource",
    "valos_raem:isOwnerOf": true,
    "valos_raem:coupledField": "",
    "rdfs:comment":
`Referrers with a missing coupledField referring this resource`,
  },

  ghostHost: {
    "@type": "valos_raem:GeneratedField",
    "rdfs:domain": "valos:Resource",
    "rdfs:range": "valos:Resource",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos_raem:expressor": ["@$valos_raem.resolveGhostHost@@"],
    "rdfs:comment":
`The instance resource which brought this ghost into being. This
instance is equivalent to the innermost ancestor of this ghost which is
not a ghost itself.`,
  },

  ghostOwner: {
    "@type": "valos_raem:EventLoggedField",
    "rdfs:domain": "valos:Resource",
    "rdfs:range": "valos:Resource",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos_raem:isOwnedBy": true,
    "valos_raem:coupledField": "valos:ghostOwnlings",
    "valos_raem:ownDefaultValue": null,
    "valos_raem:allowTransientFieldToBeSingular": true,
    "rdfs:comment":
`The instance resource which owns this materialized ghost or null if
this ghost is immaterial.
Note that materialized ghosts will have a two own fields: the
ghostOwner and the regular owner (or one of its aliases). The
removal of either of these owning field relationships will
immaterialize, not destroy, the ghost.`,
  },

  ghostOwnlings: {
    "@type": "valos_raem:CoupledField",
    "rdfs:domain": "valos:Resource",
    "rdfs:range": "valos:Resource",
    "valos_raem:isOwnerOf": true,
    "valos_raem:coupledField": "valos:ghostOwner",
    "valos_raem:ownDefaultValue": [],
    "rdfs:comment":
`Materialized ghost resources which have this instance as their ghost
host.`,
  },
};
