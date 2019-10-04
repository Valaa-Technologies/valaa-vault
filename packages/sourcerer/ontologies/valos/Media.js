module.exports = {
  Media: {
    "@type": "valos-raem:Type",
    "revdoc:brief": "file media node type",
    "rdfs:subClassOf": [
      "valos:Resource", "valos:Extant", "valos:Scope",
      "valos:SourcerableNode", "valos:SourceredNode",
    ],
    "rdfs:comment":
`The class of valospace resources which represent interpretable media
and can be associated with mutable binary content and accompanying
metadata. With Relation and Media it forms the group of three primary
node types.
`,
  },

  folder: {
    "@type": "valos-raem:EventLoggedField",
    "rdfs:subPropertyOf": "valos:directory",
    "rdfs:domain": "valos:Media",
    "rdfs:range": "valos:SourceredNode",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos-raem:isOwnedBy": true,
    "valos-raem:coupledField": "valos:medias",
    "rdfs:comment":
`The folder (and directory, owner) node of this media.`,
  },

  // Note: 'medias' has domain SourceredNode but is listed
  // here due to its coupling with 'folder'.
  medias: {
    "@type": "valos-raem:EventLoggedField",
    "rdfs:subPropertyOf": "valos:entries",
    "rdfs:domain": "valos:SourceredNode",
    "rdfs:range": "rdfs:List",
    "valos-raem:isOwnerOf": true,
    "valos-raem:coupledField": "valos:folder",
    "rdfs:comment":
`The ordered list of medias contained in this sourcered node when seen
as a folder`,
  },

  sourceURL: {
    "@type": "valos-raem:EventLoggedField",
    "rdfs:domain": "valos:Media",
    "rdfs:range": "xsd:anyURI", // still a literal
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "rdfs:comment":
`The unreliable source URL of this Media. This URL is dereferenced
when the Media content is accessed and as such is subject to all
failure considerations associated with its protocol.`,
  },

  /*
  mediaType: {
    "@type": "valos-raem:EventLoggedField",
    "rdfs:domain": "valos:Media",
    "rdfs:range": "valos:MediaType",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "rdfs:comment":
`The media type of this Media. This field is used by the gateways
to determine the default interpretation of the Media.`,
  },

  size: {
    "@type": "valos-raem:GeneratedField",
    "rdfs:domain": "valos:Media",
    "rdfs:range": "xsd:nonNegativeInteger",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos-raem:expressor": "$valos-sourcerer:resolveBvobSize",
    "rdfs:comment":
`The number of octets in the of valos:content Bvob octet-stream.`,
  },
  */

  content: {
    "@type": "valos-raem:EventLoggedField",
    "rdfs:subPropertyOf": "rdf:object",
    "rdfs:domain": "valos:Media",
    "rdfs:range": "valos:Bvob",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos-raem:coupledField": "valos:contentReferrers",
    "rdfs:comment":
`The infrastructure-backed octet-stream content of this Media.`,
  },
};
