module.exports = {
  Bvob: {
    "@type": "valos_raem:Type",
    "revdoc:brief": "Binary ValOS Object type",
    "rdfs:subClassOf": "valos:Resource",
    "rdfs:comment":
`The dominant type class of resources which are immutably associated
with an octet-stream of fixed length. Bvob resources have a hash of
that octet-stream, prefixed with the hash algorithm, as their VGRID.`
  },
  // and have a valid base64-url encoded 240-bit SHAKE256 hash of that
  // octet-streamprefixed with "hashV240:" as their VGRID.`,

  hashAlgorithm: {
    "@type": "valos_raem:GeneratedField",
    "rdfs:domain": "valos:Bvob",
    "rdfs:range": "xsd:string",
    restriction: { "@type": "owl:Restriction", "owl:cardinality": 1 },
    "valos_raem:expressor": ["@$valos_raem.resolveContextTerm:@!$valos.vrid:1:1@@"],
    "rdfs:comment":
`The hash algorithm used to create the content hash of this Bvob`,
  },

  contentHash: {
    "@type": "valos_raem:GeneratedField",
    "rdfs:domain": "valos:Bvob",
    "rdfs:range": "xsd:string",
    restriction: { "@type": "owl:Restriction", "owl:cardinality": 1 },
    "valos_raem:expressor": ["@!$valos.vrid:1:3@@"],
    "rdfs:comment":
`The content hash of the octet-stream associated with this Bvob`,
  },

  contentLength: {
    "@type": "valos_raem:GeneratedField",
    "rdfs:domain": "valos:Bvob",
    "rdfs:range": "xsd:nonNegativeInteger",
    restriction: { "@type": "owl:Restriction", "owl:cardinality": 1 },
    "valos_raem:expressor": ["@$valos_raem.resolveContentLength@@"],
    "rdfs:comment":
`The number of octets in the octet-stream associated with this Bvob.`,
  },

  contentReferrers: {
    "@type": "valos_raem:CoupledField",
    "rdfs:domain": "valos:Bvob",
    "rdfs:range": "valos:Extant",
    "valos_raem:defaultCoupledField": "valos:content",
    "rdfs:comment":
`The unordered set of valos:content references to this Bvob from
within this view of the world.`,
  },
};
