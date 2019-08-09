module.exports = {
  Bvob: {
    "@type": "valos:Type",
    "rdfs:subClassOf": "valos:Resource",
    "rdfs:comment":
`Bvob (Binary ValOS OBject) specifies a class of valos resources which
are associated with an octet-stream of fixed length. Bvob resources
have a hash of that octet-stream, prefixed with the hash algorithm, as
their resource id.`
  },
  // and have a valid base64-url encoded 240-bit SHAKE256 hash of that
  // octet-streamprefixed with "hashV240:" as their resource id.`,

  /*
  id: {
    "@type": "valos:GeneratedField",
    "rdfs:domain": "valos:Bvob",
    "rdfs:range": "rdfs:Resource",
    "valos:restriction": { "@type": "owl:Restriction", "owl:cardinality": 1 },
    "valos:generator": "null",
    "rdfs:comment":
`Content-hashed identifier of the Bvob`
  },
  */

  hashAlgorithm: {
    "@type": "valos:GeneratedField",
    "rdfs:domain": "valos:Bvob",
    "rdfs:range": "xsd:string",
    "valos:restriction": { "@type": "owl:Restriction", "owl:cardinality": 1 },
    "valos:generator": "hashAlgorithm",
    "rdfs:comment":
`The hash algorithm used to create the content hash of this Bvob`,
  },

  contentHash: {
    "@type": "valos:GeneratedField",
    "rdfs:domain": "valos:Bvob",
    "rdfs:range": "xsd:string",
    "valos:restriction": { "@type": "owl:Restriction", "owl:cardinality": 1 },
    "valos:generator": "contentHash",
    "rdfs:comment":
`The content hash of the octet-stream associated with this Bvob`,
  },

  contentLength: {
    "@type": "valos:GeneratedField",
    "rdfs:domain": "valos:Bvob",
    "rdfs:range": "xsd:nonNegativeInteger",
    "valos:restriction": { "@type": "owl:Restriction", "owl:cardinality": 1 },
    "valos:generator": "contentLength",
    "rdfs:comment":
`The number of octets in the octet-stream associated with this Bvob.`,
  },

  contentReferrers: {
    "@type": "valos:TransientField",
    "rdfs:domain": "valos:Bvob", "rdfs:range": "valos:Resource",
    "valos:defaultCoupledField": "valos:content",
    "rdfs:comment":
`Incoming references to this Bvob`,
  },
};
