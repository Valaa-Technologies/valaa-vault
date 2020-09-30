module.exports = {
  SourceredNode: {
    "@type": "VState:Type",
    "VRevdoc:brief": "sourcered node interface",
    "rdfs:subClassOf": [
      "V:Resource", "V:Extant", "V:Scope",
      "V:SourcerableNode",
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
    "@type": "VState:EventLoggedField",
    "rdfs:subPropertyOf": "V:owner",
    "rdfs:domain": "V:SourceredNode",
    "rdfs:range": "V:SourceredNode",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "VState:isOwnedBy": true,
    "VState:coupledToField": "V:nodes",
    "rdfs:comment":
`The container (and owner) node of this sourcered node.`,
  },

  nodes: {
    "@type": "VState:EventLoggedField",
    "rdfs:subPropertyOf": "V:ownlings",
    "rdfs:domain": "V:SourceredNode",
    "rdfs:range": "rdfs:List",
    "VState:isOwnerOf": true,
    "VState:coupledToField": "V:container",
    "rdfs:comment":
`The ordered list of all nodes directly contained by this sourcered
node.`,
  },

  authorityURI: {
    "@type": "VState:EventLoggedField",
    "rdfs:domain": "V:SourceredNode",
    "rdfs:range": "xsd:anyURI", // still a literal
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "VState:isDuplicateable": false,
    "VState:ownDefaultValue": null,
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
    "@type": "VState:GeneratedField",
    "rdfs:domain": "V:SourceredNode",
    "rdfs:range": "xsd:double",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "VState:expressor": ["@$VValk.resolveCreatedAt@@"],
    "rdfs:comment":
`The creation UNIX epoch time of this node. This is defined as the
log aspect timestamp of the CREATED event which impressed this node
into being.`,
  },

  modifiedAt: {
    "@type": "VState:GeneratedField",
    "rdfs:domain": "V:SourceredNode",
    "rdfs:range": "xsd:double",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "VState:expressor": ["@$VValk.resolveModifiedAt@@"],
    "rdfs:comment":
`The latest modification UNIX epoch time of this node. This is defined
as the log aspect timestamp of the most recent event with a direct
impression on this Media resource.`,
  },

  // Deprecated fields

  partitionAuthorityURI: {
    "@type": "VState:AliasField",
    "VRevdoc:deprecatedInFavorOf": "V:authorityURI",
    "VState:aliasOf": "V:authorityURI",
    "rdfs:subPropertyOf": "V:authorityURI",
    "rdfs:domain": "V:SourceredNode",
    "rdfs:range": "xsd:string",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
  },
};
