module.exports = {
  UnsourceredNode: {
    "@type": "valos-raem:Type",
    "revdoc:brief": "absent, sourceable node type",
    "rdfs:subClassOf": ["valos:Resource", "valos:SourcerableNode"],
    "rdfs:comment":
`The dominant type class of absent but sourcerable valospace nodes. An
absent resource doesn't have a known representation in this view of the
world because it is inside an unsourcered Partition.

The transition from UnsourceredNode to and from other dominant types is
the only possible runtime type change for SourcerableNodes and happens
dynamically based on the partition sourcery and banishment.`,
  },
};
