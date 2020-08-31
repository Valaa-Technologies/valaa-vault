module.exports = {
  Resource: {
    "@type": "VModel:Type",
    "VRevdoc:brief": "base resource interface",
    "rdfs:subClassOf": "rdfs:Resource",
    "rdfs:comment":
`The class of resources which can appear as a subject in valospace
resource and event graphs. The domain of all transient and generated
fields which are available even for unsourced bodies.`,
  },

  id: {
    "@type": "VModel:GeneratedField",
    "rdfs:domain": "V:Resource",
    "rdfs:range": "xsd:string",
    restriction: { "@type": "owl:Restriction", "owl:cardinality": 1 },
    "VModel:expressor": ["@$VModel.resolveId@@"],
    "rdfs:comment":
`The immutable string representation of the VRID of this resource.`,
  },

  rawId: {
    "@type": "VModel:AliasField",
    "VRevdoc:deprecatedInFavorOf": "V:id",
    "VModel:aliasOf": "V:id",
    "rdfs:subPropertyOf": "V:id",
    "rdfs:domain": "V:Resource",
    "rdfs:range": "xsd:string",
    restriction: { "@type": "owl:Restriction", "owl:cardinality": 1 },
    "rdfs:comment":
`The immutable string representation of the VRID of this resource.`,
  },

  vrid: {
    "@type": "VModel:TransientField",
    "rdfs:domain": "V:Resource",
    "rdfs:range": "rdfs:List",
    restriction: { "@type": "owl:Restriction", "owl:cardinality": 1 },
    "VModel:expressor": ["@$VModel.resolveVRIDTransient@@"],
    "rdfs:comment":
`The immutable, segmented object representation of the VRID of this
resource.`,
  },

  typeName: {
    "@type": "VModel:GeneratedField",
    "rdfs:domain": "V:Resource",
    "rdfs:range": "xsd:string",
    restriction: { "@type": "owl:Restriction", "owl:cardinality": 1 },
    "VModel:expressor": ["@$VModel.resolveDominantTypeName@@"],
    "rdfs:comment":
`The dominant type name of this resource`,
  },

  prototype: {
    "@type": "VModel:EventLoggedField",
    "rdfs:domain": "V:Resource",
    "rdfs:range": "V:Resource",
    "VModel:coupledField": "V:derivations",
    "rdfs:comment":
`The prototypes of this resource. All field lookups for which there is
no associated value set and whose field descriptors don't have
ownDefaultValue are forwarded to the prototype.`,
  },

  derivations: {
    "@type": "VModel:CoupledField",
    "rdfs:domain": "V:Resource",
    "rdfs:range": "V:Resource",
    "VModel:coupledField": "V:prototype",
    "VModel:preventsDestroy": true,
    "VModel:ownDefaultValue": [],
    "rdfs:comment":
`An unordered set of resources which have this resource as their
V:prototype.`,
  },

  ownFields: {
    "@type": "VModel:TransientField",
    "rdfs:domain": "V:Resource",
    "rdfs:range": "V:Resource",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "VModel:expressor": ["@$VModel.resolveOwnFieldsTransient@@"],
    "rdfs:comment":
`A transient version of this object as if prototype was undefined.
All property accesses will only return field values which are directly
owned by this resource.`,
  },

  inheritors: {
    "@type": "VModel:CoupledField",
    "rdfs:subPropertyOf": "V:derivations",
    "rdfs:domain": "V:Resource",
    "rdfs:range": "V:Resource",
    "VModel:coupledField": "V:inheritancePrototype",
    "VModel:preventsDestroy": true,
    "VModel:ownDefaultValue": [],
    "rdfs:comment":
`An unordered set of resources which have this resource as their
V:inheritancePrototype.`,
  },

  instances: {
    "@type": "VModel:CoupledField",
    "rdfs:subPropertyOf": "V:derivations",
    "rdfs:domain": "V:Resource",
    "rdfs:range": "V:Resource",
    "VModel:coupledField": "V:instancePrototype",
    "VModel:preventsDestroy": true,
    "VModel:ownDefaultValue": [],
    "rdfs:comment":
`An unordered set of resources which have this resource as their
direct V:instancePrototype.`,
  },

  ghostPrototype: {
    "@type": "VModel:GeneratedField",
    "rdfs:subPropertyOf": "V:prototype",
    "rdfs:domain": "V:Resource",
    "rdfs:range": "V:Resource",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "VModel:expressor": ["@$VModel.resolveGhostPrototype@@"],
    "VModel:coupledField": "V:ghosts",
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
    "@type": "VModel:CoupledField",
    "rdfs:subPropertyOf": "V:derivations",
    "rdfs:domain": "V:Resource",
    "rdfs:range": "V:Resource",
    "VModel:coupledField": "V:ghostPrototype",
    "VModel:preventsDestroy": true,
    "VModel:ownDefaultValue": [],
    "rdfs:comment":
`An unordered set of all (materialized) ghosts which have this resource
as their V:ghostPrototype. See @valos/raem#section_ghost_instancing
for why immaterial ghosts are not listed.`,
  },

  materializedGhosts: {
    "@type": "VModel:AliasField",
    "VRevdoc:deprecatedInFavorOf": "V:ghosts",
    "VModel:aliasOf": "V:ghosts",
    "rdfs:subPropertyOf": "V:ghosts",
    "rdfs:domain": "V:Resource",
    "rdfs:range": "V:Resource",
    "VModel:coupledField": "V:ghostPrototype",
    "VModel:preventsDestroy": true,
    "VModel:ownDefaultValue": [],
  },

  unnamedCouplings: {
    "@type": "VModel:CoupledField",
    "rdfs:domain": "V:Resource",
    "rdfs:range": "V:Resource",
    "VModel:isOwnerOf": true,
    "VModel:coupledField": "",
    "rdfs:comment":
`Referrers with a missing coupledField referring this resource`,
  },

  ghostHost: {
    "@type": "VModel:GeneratedField",
    "rdfs:domain": "V:Resource",
    "rdfs:range": "V:Resource",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "VModel:expressor": ["@$VModel.resolveGhostHost@@"],
    "rdfs:comment":
`The instance resource which brought this ghost into being. This
instance is equivalent to the innermost ancestor of this ghost which is
not a ghost itself.`,
  },

  ghostOwner: {
    "@type": "VModel:EventLoggedField",
    "rdfs:domain": "V:Resource",
    "rdfs:range": "V:Resource",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "VModel:isOwnedBy": true,
    "VModel:coupledField": "V:ghostOwnlings",
    "VModel:ownDefaultValue": null,
    "VModel:allowTransientFieldToBeSingular": true,
    "rdfs:comment":
`The instance resource which owns this materialized ghost or null if
this ghost is immaterial.
Note that materialized ghosts will have a two own fields: the
ghostOwner and the regular owner (or one of its aliases). The
removal of either of these owning field relationships will
immaterialize, not destroy, the ghost.`,
  },

  ghostOwnlings: {
    "@type": "VModel:CoupledField",
    "rdfs:domain": "V:Resource",
    "rdfs:range": "V:Resource",
    "VModel:isOwnerOf": true,
    "VModel:coupledField": "V:ghostOwner",
    "VModel:ownDefaultValue": [],
    "rdfs:comment":
`Materialized ghost resources which have this instance as their ghost
host.`,
  },
};
