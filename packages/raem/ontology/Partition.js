module.exports = {
  Partition: {
    "rdf:type": "valos:Type",
    "rdfs:subClassOf": "valos:Resource",
    "revdoc:brief": "partition",
    "rdfs:comment":
`A Partition is a subdivision of the whole ValOS object space into
smaller recursive wholes. The Partition implementation contains
Resource's either by direct or transitive ownership. Each such
contained Resource also knows their containing Partition.

TODO(iridian, 2019-08): Update outdated terminology in this comment.

In addition to the few direct member fields relating to snapshotting
and event stream synchronization, the Partition Resource's serve as
a key latching point for external services.

Each Partition object is managed by an authority, which performs
conflict resolution, authorization and recording of incoming commands,
converting them into the truth event log for that particular Partition.

The Partition id is used by the query routers to globally locate the
authority responsible for any given Partition. Also, cross-partition
Resource references are implemented as Resource stubs, ie. objects that
only contain the Resource id and its most recently known partition
(which will retain the new owning Partition in a stub, enabling
forwarding). Together these allow for any Resource to always be
locateable from anywhere.`,
  },

  authorityIRI: {
    "rdf:type": "valos:PrimaryField",
    "rdfs:domain": "valos:Partition",
    "rdfs:range": "xsd:string",
    "valos:propertyRestriction": { "rdf:type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos:isDuplicateable": false,
    "valos:immediateDefaultValue": null,
    "rdfs:comment":
`The authority IRI of this Resource. If this field is set it means that
this is an active partition root object. The partition IRI is generated
as per the rules specified by the authority IRI schema.`,
  },

  partitionAuthorityURI: {
    "rdf:type": "valos:AliasField",
    "valos:aliasOf": "valos:authorityIRI",
    "rdfs:subPropertyOf": "valos:authorityIRI",
    "rdfs:domain": "valos:Partition",
    "rdfs:range": "xsd:string",
    "valos:propertyRestriction": { "rdf:type": "owl:Restriction", "owl:maxCardinality": 1 },
    "revdoc:deprecatedInFavorOf": "valos:authorityIRI",
  },
};
