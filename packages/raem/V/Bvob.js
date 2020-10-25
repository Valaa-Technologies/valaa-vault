module.exports = {
  Bvob: {
    "@type": "VState:Type",
    "VRevdoc:brief": "Binary ValOS Object type",
    "rdfs:subClassOf": "V:Resource",
    "rdfs:comment":
`The dominant type class of resources which are immutably associated
with an octet-stream of fixed length.`,
    "VRevdoc:introduction":
`Bvob resource id is the hash of the octet-stream prefixed with the
hash algorithm, as their VGRID.

Unlike any other valospace resources, Bvobs are shared, not owned on
the object level. Multiple Bvob's with the same id can be CREATED in
many chronicles (or in fact, even in the same chronicle).

Conversely a Bvob cannot be destroyed but only released by nulling all
references to it. Once a chronicle has no references to a specific Bvob
the authority is allowed to free the octet-stream resources associated
with.`
  },
  // and have a valid base64-url encoded 240-bit SHAKE256 hash of that
  // octet-stream prefixed with "hashV240:" as their VGRID.`,

  hashAlgorithm: {
    "@type": "VState:GeneratedField",
    "rdfs:domain": "V:Bvob",
    "rdfs:range": "xsd:string",
    restriction: { "@type": "owl:Restriction", "owl:cardinality": 1 },
    "VState:expressor": ["@$VValk.resolveContextTerm:@!$valos.vrid:1:1@@"],
    "rdfs:comment":
`The hash algorithm used to create the content hash of this Bvob`,
  },

  contentHash: {
    "@type": "VState:GeneratedField",
    "rdfs:domain": "V:Bvob",
    "rdfs:range": "xsd:string",
    restriction: { "@type": "owl:Restriction", "owl:cardinality": 1 },
    "VState:expressor": ["@!$valos.vrid:1:3@@"],
    "rdfs:comment":
`The content hash of the octet-stream associated with this Bvob`,
  },

  contentLength: {
    "@type": "VState:GeneratedField",
    "rdfs:domain": "V:Bvob",
    "rdfs:range": "xsd:nonNegativeInteger",
    restriction: { "@type": "owl:Restriction", "owl:cardinality": 1 },
    "VState:expressor": ["@$VValk.resolveContentLength@@"],
    "rdfs:comment":
`The number of octets in the octet-stream associated with this Bvob.`,
  },

  contentReferrers: {
    "@type": "VState:CoupledField",
    "rdfs:domain": "V:Bvob",
    "rdfs:range": "V:Extant",
    "VState:defaultCoupledField": "V:content",
    "rdfs:comment":
`The unordered set of V:content references to this Bvob from
within this view of the world.`,
  },
};
