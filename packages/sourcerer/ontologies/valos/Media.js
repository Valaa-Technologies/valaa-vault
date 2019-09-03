module.exports = {
  Media: {
    "@type": "valos-raem:Type",
    "rdfs:subClassOf": [
      "valos:Resource", "valos:Sourced",
      "valos:ScriptResource", "valos:Scope", "valos:Relatable",
    ],
    "revdoc:brief": "primary file media type",
    "rdfs:comment":
`The class of valospace resources which represent interpretable media
and can be associated with mutable binary content and accompanying
metadata. With Relation and Media it forms the group of three primary
types.
`,
  },

  container: {
    "@type": "valos-raem:AliasField",
    "valos-raem:aliasOf": "valos:owner",
    "rdfs:subPropertyOf": "valos:owner",
    "rdfs:domain": "valos:Media",
    "rdfs:range": "valos:Relatable",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos-raem:isOwnedBy": true,
    "valos-raem:coupledField": "valos:medias",
    "rdfs:comment":
`The container (and owner) relatable of this media.`,
  },

  // Note: 'medias' has domain Relatable but is listed here.
  medias: {
    "@type": "valos-raem:AliasField",
    "valos-raem:aliasOf": "valos:ownlings",
    "rdfs:subPropertyOf": "valos:ownlings",
    "rdfs:domain": "valos:Relatable",
    "rdfs:range": "rdfs:List",
    "valos-raem:isOwnerOf": true,
    "valos-raem:coupledField": "valos:container",
    "rdfs:comment":
`The ordered list of medias contained in this relatable`,
  },

  sourceURL: {
    "@type": "valos-raem:PrimaryField",
    "rdfs:domain": "valos:Media",
    "rdfs:range": "xsd:anyURI",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "rdfs:comment":
`The unreliable source URL of this Media. This URL is dereferenced
when the Media content is accessed and as such is subject to all
failure considerations associated with its protocol.`,
  },

  /*
  mediaType: {
    "@type": "valos-raem:PrimaryField",
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
    "valos-raem:generator": "bvobSize",
    "rdfs:comment":
`The number of octets in the of valos:content Bvob octet-stream.`,
  },
  */

  content: {
    "@type": "valos-raem:PrimaryField",
    "rdfs:subPropertyOf": "rdf:object",
    "rdfs:domain": "valos:Media",
    "rdfs:range": "valos:Bvob",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos-raem:coupledField": "valos:contentReferrers",
    "rdfs:comment":
`The infrastructure-backed octet-stream content of this Media.`,
  },

  created: {
    "@type": "valos-raem:GeneratedField",
    "rdfs:domain": "valos:Media",
    "rdfs:range": "xsd:double",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos-raem:generator": "created",
    "rdfs:comment":
`The creation UNIX epoch time of this Media. This is defined as the
truth log aspect timestamp of the CREATED event which brought this
Media into being.`,
  },

  modified: {
    "@type": "valos-raem:GeneratedField",
    "rdfs:domain": "valos:Media",
    "rdfs:range": "xsd:double",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos-raem:generator": "modified",
    "rdfs:comment":
`The latest modification UNIX epoch time of this Media. This is defined
as the truth log aspect timestamp of the most recent event that
directly affects this Media resource.`,
  },
};
