module.exports = {
  SourceredNode: {
    "@type": "valos_raem:Type",
    "revdoc:brief": "sourcered node interface",
    "rdfs:subClassOf": [
      "valos:Resource", "valos:Extant", "valos:Scope",
      "valos:SourcerableNode",
    ],
    "rdfs:comment":
`The class of sourcered (ie. extant) valospace nodes. A node can act as
a chronicle root resource, as the source and target of Relation nodes,
as the folder of Media nodes and as the parent of Entity nodes.
As these aforementioned types are also the primary sourcered nodes
themselves they form the main structure of global valospace resource
graph.`,
  },

  container: {
    "@type": "valos_raem:EventLoggedField",
    "rdfs:subPropertyOf": "valos:owner",
    "rdfs:domain": "valos:SourceredNode",
    "rdfs:range": "valos:SourceredNode",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos_raem:isOwnedBy": true,
    "valos_raem:coupledField": "valos:nodes",
    "rdfs:comment":
`The container (and owner) node of this sourcered node.`,
  },

  nodes: {
    "@type": "valos_raem:EventLoggedField",
    "rdfs:subPropertyOf": "valos:ownlings",
    "rdfs:domain": "valos:SourceredNode",
    "rdfs:range": "rdfs:List",
    "valos_raem:isOwnerOf": true,
    "valos_raem:coupledField": "valos:container",
    "rdfs:comment":
`The ordered list of all nodes directly contained by this sourcered
node.`,
  },

  authorityURI: {
    "@type": "valos_raem:EventLoggedField",
    "rdfs:domain": "valos:SourceredNode",
    "rdfs:range": "xsd:anyURI", // still a literal
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos_raem:isDuplicateable": false,
    "valos_raem:ownDefaultValue": null,
    "rdfs:comment":
`The authority URL of this sourcered chronicle root node. If this field
is null then this sourcered node is not a root node. Setting this field
makes this resource the root of a new chronicle root (if allowed). The
chronicle URL is generated based on this as per the rules specified by
the authority URL schema.
If the chronicle root node is frozen the whole chronicle is permanently
frozen.`,
  },

  createdAt: {
    "@type": "valos_raem:GeneratedField",
    "rdfs:domain": "valos:SourceredNode",
    "rdfs:range": "xsd:double",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos_raem:expressor": ["@$valos_sourcerer.resolveCreatedAt@@"],
    "rdfs:comment":
`The creation UNIX epoch time of this node. This is defined as the
log aspect timestamp of the CREATED event which impressed this node
into being.`,
  },

  modifiedAt: {
    "@type": "valos_raem:GeneratedField",
    "rdfs:domain": "valos:SourceredNode",
    "rdfs:range": "xsd:double",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos_raem:expressor": ["@$valos_sourcerer.resolveModifiedAt@@"],
    "rdfs:comment":
`The latest modification UNIX epoch time of this node. This is defined
as the log aspect timestamp of the most recent event with a direct
impression on this Media resource.`,
  },

  // Deprecated fields

  partitionAuthorityURI: {
    "@type": "valos_raem:AliasField",
    "revdoc:deprecatedInFavorOf": "valos:authorityURI",
    "valos_raem:aliasOf": "valos:authorityURI",
    "rdfs:subPropertyOf": "valos:authorityURI",
    "rdfs:domain": "valos:SourceredNode",
    "rdfs:range": "xsd:string",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
  },
};
