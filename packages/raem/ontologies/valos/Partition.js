module.exports = {
  Partition: {
    "@type": "valos-raem:Type",
    "rdfs:subClassOf": "valos:Sourced",
    "revdoc:brief": "a document, world subdivision interface",
    "rdfs:comment":
`A Partition is a subdivision of the whole ValOS object space into
smaller recursive, individually sourcable wholes. The Partition
implementation contains resources either by direct or transitive
ownership. Each such contained resource also knows their containing
Partition.

TODO(iridian, 2019-08): Update outdated terminology in this comment.

In addition to the few direct member fields relating to snapshotting
and event stream synchronization, the Partition resources serve as
a key latching point for external services.

Each Partition object is managed by an authority, which performs
conflict resolution, authorization and recording of incoming commands,
converting them into the truth event log for that particular Partition.

The Partition id is used by the query routers to globally locate the
authority responsible for any given Partition. Also, cross-partition
resource references are implemented as Unsourced resource stubs, ie.
objects that only contain the resource id and its most recently known
partition (which will retain the new owning Partition in a stub,
enabling forwarding). Together these allow for any resource to always
be eventually locateable from anywhere.`,
  },

  authorityIRI: {
    "@type": "valos-raem:PrimaryField",
    "rdfs:domain": "valos:Partition",
    "rdfs:range": "xsd:anyURI",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos-raem:isDuplicateable": false,
    "valos-raem:ownDefaultValue": null,
    "rdfs:comment":
`The authority IRI of this resource. If this field is set it means that
this is an active partition root object. The partition IRI is generated
as per the rules specified by the authority IRI schema.`,
  },

  partitionAuthorityURI: {
    "@type": "valos-raem:AliasField",
    "revdoc:deprecatedInFavorOf": "valos:authorityIRI",
    "valos-raem:aliasOf": "valos:authorityIRI",
    "rdfs:subPropertyOf": "valos:authorityIRI",
    "rdfs:domain": "valos:Partition",
    "rdfs:range": "xsd:string",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
  },
};
