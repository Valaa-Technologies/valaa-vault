module.exports = {
  NonExistentNode: {
    "@type": "valos_raem:Type",
    "rdfs:subClassOf": ["valos:Resource", "valos:SourcerableNode"],
    "revdoc:brief": "non-existent node type",
    "rdfs:comment":
`The dominant type class of sourcered resources which should be present
but are not. This typically because they have been destroyed or because
they never existed in the first place.

Only provides the transient fields of the SourcerableNode and Resource
interfaces.`,
  },
};
