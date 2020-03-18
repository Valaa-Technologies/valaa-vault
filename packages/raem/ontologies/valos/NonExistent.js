module.exports = {
  NonExistent: {
    "@type": "valos_raem:Type",
    "revdoc:brief:": "non-existent resource type",
    "rdfs:subClassOf": "valos:Resource",
    "rdfs:comment":
`The dominant type class of resources which should be present but are
not. This is typically because they have been destroyed or because they
have never existed in the first place.

Only provides the transient fields of the Resource interface.`,
  },
};
