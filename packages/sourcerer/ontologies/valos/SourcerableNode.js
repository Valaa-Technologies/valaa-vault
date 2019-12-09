module.exports = {
  SourcerableNode: {
    "@type": "valos-raem:Type",
    "rdfs:subClassOf": "valos:Resource",
    "revdoc:brief": "sourcerable node interface",
    "rdfs:comment":
`The class of sourcerable valospace nodes which either are already
sourcered or are unsourcered but have references to them from extant
resources.

This interface is the domain of all transient and generated fields
which are available even for unsourcered node resources.`,
  },

  /*
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
resource references are implemented as Absent resource stubs, ie.
objects that only contain the resource id and its most recently known
partition (which will retain the new owning Partition in a stub,
enabling forwarding). Together these allow for any resource to always
be eventually locateable from anywhere.`,
  */

  partitionRoot: {
    "@type": "valos-raem:GeneratedField",
    "rdfs:domain": "valos:SourcerableNode",
    "rdfs:range": "valos:SourceredNode",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos-raem:expressor": "$valos-sourcerer:resolvePartitionRoot",
    "rdfs:comment":
`The partition root node of this sourcerable (ie. the nearest ancestor,
possibly this sourcerable itself self which has a non-null
valos:authorityURI).`,
  },

  partitionURL: {
    "@type": "valos-raem:GeneratedField",
    "rdfs:domain": "valos:SourcerableNode",
    "rdfs:range": "xsd:anyURI", // still a literal
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos-raem:expressor": "$valos-sourcerer:resolvePartitionURL",
    "rdfs:comment":
`The partition URL of the event log that contain this potentially
absent sourcerable as is known by the current view of the world.`,
  },

  url: {
    "@type": "valos-raem:GeneratedField",
    "rdfs:domain": "valos:SourcerableNode",
    "rdfs:range": "xsd:anyURI", // still a literal
    restriction: { "@type": "owl:Restriction", "owl:cardinality": 1 },
    "valos-raem:expressor": ["$valk:add:@!$V:partitionURL@", [":", "#"], ":@!$V:id@"],
    "rdfs:comment":
`The authoritative URL string of this sourcerable in the current view
of the world. Always equivalent to a catenation of
<valos:partitionURL> "#" <valos:id>
of this resource`,
  },

  // Deprecated fields

  partition: {
    "@type": "valos-raem:AliasField",
    "revdoc:deprecatedInFavorOf": "valos:partitionRoot",
    "valos-raem:aliasOf": "valos:partitionRoot",
    "rdfs:subPropertyOf": "valos:partitionRoot",
    "rdfs:domain": "valos:SourcerableNode",
    "rdfs:range": "valos:SourceredNode",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos-raem:expressor": "$valos-sourcerer:resolvePartitionRoot",
    "rdfs:comment":
`The partition root node of this sourcerable, ie. the nearest ancestor
(possibly self) with a non-null valos:authorityURI.`,
  },

  partitionURI: {
    "@type": "valos-raem:AliasField",
    "revdoc:deprecatedInFavorOf": "valos:partitionURL",
    "valos-raem:aliasOf": "valos:partitionURL",
    "rdfs:subPropertyOf": "valos:partitionURL",
    "rdfs:domain": "valos:SourcerableNode",
    "rdfs:range": "xsd:anyURI",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "rdfs:comment":
`Deprecated in favor of 'partitionURL'. This field is by definition
always a locator so its name should reflect it.`,
  },
};
