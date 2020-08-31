module.exports = {
  Bvob: {
    "@type": "VModel:Type",
    "VRevdoc:brief": "Binary ValOS Object type",
    "rdfs:subClassOf": "V:Resource",
    "rdfs:comment":
`The dominant type class of resources which are immutably associated
with an octet-stream of fixed length. Bvob resources have a hash of
that octet-stream, prefixed with the hash algorithm, as their VGRID.`
  },
  // and have a valid base64-url encoded 240-bit SHAKE256 hash of that
  // octet-streamprefixed with "hashV240:" as their VGRID.`,

  hashAlgorithm: {
    "@type": "VModel:GeneratedField",
    "rdfs:domain": "V:Bvob",
    "rdfs:range": "xsd:string",
    restriction: { "@type": "owl:Restriction", "owl:cardinality": 1 },
    "VModel:expressor": ["@$VModel.resolveContextTerm:@!$valos.vrid:1:1@@"],
    "rdfs:comment":
`The hash algorithm used to create the content hash of this Bvob`,
  },

  contentHash: {
    "@type": "VModel:GeneratedField",
    "rdfs:domain": "V:Bvob",
    "rdfs:range": "xsd:string",
    restriction: { "@type": "owl:Restriction", "owl:cardinality": 1 },
    "VModel:expressor": ["@!$valos.vrid:1:3@@"],
    "rdfs:comment":
`The content hash of the octet-stream associated with this Bvob`,
  },

  contentLength: {
    "@type": "VModel:GeneratedField",
    "rdfs:domain": "V:Bvob",
    "rdfs:range": "xsd:nonNegativeInteger",
    restriction: { "@type": "owl:Restriction", "owl:cardinality": 1 },
    "VModel:expressor": ["@$VModel.resolveContentLength@@"],
    "rdfs:comment":
`The number of octets in the octet-stream associated with this Bvob.`,
  },

  contentReferrers: {
    "@type": "VModel:CoupledField",
    "rdfs:domain": "V:Bvob",
    "rdfs:range": "V:Extant",
    "VModel:defaultCoupledField": "V:content",
    "rdfs:comment":
`The unordered set of V:content references to this Bvob from
within this view of the world.`,
  },
};
