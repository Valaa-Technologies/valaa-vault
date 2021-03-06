module.exports = {
  Media: {
    "@type": "VState:Type",
    "VRevdoc:brief": "file media node type",
    "rdfs:subClassOf": [
      "V:Resource", "V:Extant", "V:Scope",
      "V:SourcerableNode", "V:SourceredNode",
    ],
    "rdfs:comment":
`The class of valospace resources which represent interpretable media
and can be associated with mutable binary content and accompanying
metadata. With Relation and Media it forms the group of three primary
node types.
`,
  },

  folder: {
    "@type": "VState:EventLoggedField",
    "rdfs:subPropertyOf": "V:directory",
    "rdfs:domain": "V:Media",
    "rdfs:range": "V:SourceredNode",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "VState:isOwnedBy": true,
    "VState:linkedToField": "V:ownsMedia",
    "rdfs:comment":
`The folder (and directory, owner) node of this media.`,
  },

  // Note: 'medias' has domain SourceredNode but is listed
  // here due to its coupling with 'folder'.
  ownsMedia: {
    "@type": "VState:EventLoggedField",
    "rdfs:subPropertyOf": "V:entries",
    "rdfs:domain": "V:SourceredNode",
    "rdfs:range": "rdfs:List",
    "VState:isOwnerOf": true,
    "VState:linkedToField": "V:folder",
    "rdfs:comment":
`The ordered list of medias contained in this sourcered node when seen
as a folder`,
  },

  sourceURL: {
    "@type": "VState:EventLoggedField",
    "rdfs:domain": "V:Media",
    "rdfs:range": "xsd:anyURI", // still a literal
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "rdfs:comment":
`The unreliable source URL of this Media. This URL is dereferenced
when the Media content is accessed and as such is subject to all
failure considerations associated with its protocol.`,
  },

  /*
  mediaType: {
    "@type": "VState:EventLoggedField",
    "rdfs:domain": "V:Media",
    "rdfs:range": "V:MediaType",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "rdfs:comment":
`The media type of this Media. This field is used by the gateways
to determine the default interpretation of the Media.`,
  },

  size: {
    "@type": "VState:GeneratedField",
    "rdfs:domain": "V:Media",
    "rdfs:range": "xsd:nonNegativeInteger",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "VState:expressor": ["@$VValk.resolveBvobSize@@"],
    "rdfs:comment":
`The number of octets in the of V:content Bvob octet-stream.`,
  },
  */

  content: {
    "@type": "VState:EventLoggedField",
    "rdfs:subPropertyOf": "rdf:object",
    "rdfs:domain": "V:Media",
    "rdfs:range": "V:Bvob",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "VState:coupledToField": "V:contentReferrers",
    "rdfs:comment":
`The infrastructure-backed octet-stream content of this Media.`,
  },
};
