module.exports = {
  Media: {
    "@type": "valos:Type",
    "rdfs:subClassOf": [
      "valos:TransientFields", "valos:Resource",
      "valos:TransientScriptFields", "valos:Scope", "valos:Relatable",
    ],
    "revdoc:brief": "media",
    "rdfs:comment":
`The class of valospace resources which represent interpretable media
and can be associated with binary content and accompanying metadata.`,
  },

  container: {
    "@type": "valos:AliasField",
    "valos:aliasOf": "valos:owner",
    "rdfs:subPropertyOf": "valos:owner",
    "rdfs:domain": "valos:Media",
    "rdfs:range": "valos:Relatable",
    "valos:restriction": { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos:isOwned": true,
    "valos:coupledField": "valos:medias",
    "rdfs:comment":
`The container (and owner) relatable of this media.`,
  },

  // Note: 'medias' has domain Relatable but is listed here.
  medias: {
    "@type": "valos:AliasField",
    "valos:aliasOf": "valos:ownlings",
    "rdfs:subPropertyOf": "valos:ownlings",
    "rdfs:domain": "valos:Relatable",
    "rdfs:range": "rdfs:List",
    "valos:isOwning": true,
    "valos:coupledField": "valos:container",
    "rdfs:comment":
`The ordered list of medias contained in this relatable`,
  },

  sourceURL: {
    "@type": "valos:PrimaryField",
    "rdfs:domain": "valos:Media",
    "rdfs:range": "xsd:anyURI",
    "valos:restriction": { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "rdfs:comment":
`The unreliable source URL of this Media. This URL is dereferenced
when the Media content is accessed and as such is subject to all
failure considerations associated with its protocol.`,
  },

  /*
  mediaType: {
    "@type": "valos:PrimaryField",
    "rdfs:domain": "valos:Media",
    "rdfs:range": "valos:MediaType",
    "valos:restriction": { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "rdfs:comment":
`The media type of this Media. This field is used by the gateways
to determine the default interpretation of the Media.`,
  },

  size: {
    "@type": "valos:GeneratedField",
    "rdfs:domain": "valos:Media",
    "rdfs:range": "xsd:nonNegativeInteger",
    "valos:restriction": { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos:generator": "bvobSize",
    "rdfs:comment":
`The number of octets in the of valos:content Bvob octet-stream.`,
  },
  */

  content: {
    "@type": "valos:PrimaryField",
    "rdfs:domain": "valos:Media",
    "rdfs:range": "valos:Bvob",
    "valos:restriction": { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos:coupledField": "valos:contentReferrers",
    "rdfs:comment":
`The infrastructure-backed octet-stream content of this Media.`,
  },

  created: {
    "@type": "valos:GeneratedField",
    "rdfs:domain": "valos:Media",
    "rdfs:range": "xsd:double",
    "valos:restriction": { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos:generator": "created",
    "rdfs:comment":
`The creation UNIX epoch time of this Media. This is defined as the
truth log aspect timestamp of the CREATED event which brought this
Media into being.`,
  },

  modified: {
    "@type": "valos:GeneratedField",
    "rdfs:domain": "valos:Media",
    "rdfs:range": "xsd:double",
    "valos:restriction": { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos:generator": "modified",
    "rdfs:comment":
`The latest modification UNIX epoch time of this Media. This is defined
as the truth log aspect timestamp of the most recent event that
directly affects this Media resource.`,
  },
};
