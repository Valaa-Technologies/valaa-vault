module.exports = {
  Bvob: {
    "rdf:type": "valos:Type",
    "rdfs:subClassOf": "valos:Resource",
    "rdfs:comment":
`Bvob (Binary ValOS OBject) specifies a class of valos resources which
have a valid base64-url encoded 240-bit SHAKE256 hash of some
octet-stream content prefixed with "hashV240:" as their resource id.`,
  },

  id: {
    "rdf:type": "valos:GeneratedField",
    "rdfs:domain": "valos:Bvob", "rdfs:range": "rdfs:Resource",
    "valos:propertyRestriction": { "rdf:type": "owl:Restriction", "owl:cardinality": 1 },
    "valos:generator": "null",
    "rdfs:comment":
`Content-hashed identifier of the Bvob`
  },

  contentHash: {
    "rdf:type": "valos:GeneratedField",
    "rdfs:domain": "valos:Bvob", "rdfs:range": "xsd:string",
    "valos:propertyRestriction": { "rdf:type": "owl:Restriction", "owl:cardinality": 1 },
    "valos:generator": "$V.id.rawId()",
    "rdfs:comment":
`The content has of this Bvob`
  },

  contentReferrers: {
    "rdf:type": "valos:TransientField",
    "rdfs:domain": "valos:Bvob", "rdfs:range": "valos:Resource",
    "valos:defaultCoupledField": "valos:content",
    "rdfs:comment":
`Incoming references to this Bvob`,
  },
};
