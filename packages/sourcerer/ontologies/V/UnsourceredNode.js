module.exports = {
  UnsourceredNode: {
    "@type": "VModel:Type",
    "VRevdoc:brief": "absent, sourceable node type",
    "rdfs:subClassOf": ["V:Resource", "V:SourcerableNode"],
    "rdfs:comment":
`The dominant type class of absent but sourcerable valospace nodes. An
absent resource doesn't have a known representation in this view of the
world because it is inside an unsourcered Chronicle.

The transition from UnsourceredNode to and from other dominant types is
the only possible runtime type change for SourcerableNodes and happens
dynamically based on the chronicle sourcery and banishment.`,
  },
};
