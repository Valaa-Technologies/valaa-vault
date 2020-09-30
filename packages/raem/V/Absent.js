module.exports = {
  Absent: {
    "@type": "VState:Type",
    "VRevdoc:brief": "absent resource type",
    "rdfs:subClassOf": "V:Resource",
    "rdfs:comment":
`The dominant type class of absent valospace resources. An absent
resource doesn't have a known representation in this view of the world,
buts its existence is inferred due to existing references to it.

The transition from Absent to and from other dominant types is the
only possible runtime type change and happens dynamically based on
the chronicle sourcery and banishment.`,
  },
};
