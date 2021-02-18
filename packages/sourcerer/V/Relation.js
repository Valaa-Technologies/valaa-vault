module.exports = {
  Relation: {
    "@type": "VState:Type",
    "rdfs:subClassOf": [
      "V:Resource", "V:Extant", "V:Scope",
      "V:SourcerableNode", "V:SourceredNode",
    ],
    "VRevdoc:brief": "directed relationship node type",
    "rdfs:comment":
`The class of valospace resources which represent directed,
many-to-many relationships between nodes.
With Entity and Media it forms the group of three primary node types.
As a Scope it can have scriptable properties. Relation being
a SourceredNode itself allows for nested and recursive relationship
structures.`,
  },

  graph: {
    "@type": "VState:EventLoggedField",
    "rdfs:subPropertyOf": "V:container",
    "rdfs:domain": "V:Relation",
    "rdfs:range": "V:SourceredNode",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "VState:isOwnedBy": true,
    "VState:coupledToField": "V:ownsRelation",
    "rdfs:comment":
`The graph (and container, owner) node of this relation.
Typically also either the source or the target but possibly neither.`,
  },

  // Note: 'ownsRelation' has domain SourceredNode but is listed
  // here due to its coupling with 'graph'.
  ownsRelation: {
    "@type": "VState:EventLoggedField",
    "rdfs:subPropertyOf": "V:nodes",
    "rdfs:domain": "V:SourceredNode",
    "rdfs:range": "rdfs:List",
    "VState:isOwnerOf": true,
    "VState:coupledToField": "V:graph",
    "rdfs:comment":
`The ordered list of relations that are connected (and contained,
owned) _by_ this sourcered node. This includes both
ownsInRelation and ownsOutRelation (ie. incoming and
outgoing relations which are also connected by this sourcered node) but
also relations which only have this sourcered node as their graph
but not as source or target.`,
  },

  source: {
    "@type": "VState:EventLoggedField",
    "rdfs:subPropertyOf": "rdf:subject",
    "rdfs:domain": "V:Relation",
    "rdfs:range": "V:SourceredNode",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "VState:coupledToField": "V:outRelation",
    "rdfs:comment":
`The source node of this relation.`,
  },

  // Note: 'outgoingRelations' has domain SourcerableNode but is listed
  // here due to its coupling with 'source'.
  outRelation: {
    "@type": "VState:CoupledField",
    "rdfs:subPropertyOf": "V:nodes",
    "rdfs:domain": "V:SourcerableNode",
    "rdfs:range": "rdfs:List",
    "VState:coupledToField": "V:source",
    "rdfs:comment":
`The unordered list of outgoing relations with this sourcerable
(but possibly absent) node as their source (note that sourcerable and
source are completely separate concepts here).`,
  },

  target: {
    "@type": "VState:EventLoggedField",
    "rdfs:subPropertyOf": "rdf:object",
    "rdfs:domain": "V:Relation",
    "rdfs:range": "V:SourceredNode",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "VState:coupledToField": "V:inRelation",
    "rdfs:comment":
`The target node of this relation.`,
  },

  // Note: 'incomingRelations' has domain SourcerableNode but is listed
  // here due to its coupling with 'source'.
  inRelation: {
    "@type": "VState:CoupledField",
    "rdfs:subPropertyOf": "V:nodes",
    "rdfs:domain": "V:SourcerableNode",
    "rdfs:range": "rdfs:List",
    "VState:coupledToField": "V:target",
    "rdfs:comment":
`The unordered list of incoming relations with this sourcerable
(but possibly absent) node as their target.`,
  },

  pairedSource: {
    "@type": "VState:EventLoggedField",
    "rdfs:subPropertyOf": "V:source",
    "rdfs:domain": "V:Relation",
    "rdfs:range": "V:SourceredNode",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "VState:coupledToField": "V:pairedOutRelation",
    "rdfs:comment":
`The paired source node of this relation (paired denotes that the
coupled field 'pairedOutRelation' is an event logged field).`,
  },

  // Note: 'pairedOutRelation' has domain SourceredNode but is listed
  // here due to its coupling with 'pairedSource'.
  pairedOutRelation: {
    "@type": "VState:EventLoggedField",
    "rdfs:subPropertyOf": "V:outgoingRelations",
    "rdfs:domain": "V:SourceredNode",
    "rdfs:range": "rdfs:List",
    "VState:coupledToField": "V:pairedSource",
    "rdfs:comment":
`The ordered list of outgoing relations paired to this sourcered node.`,
  },

  pairedTarget: {
    "@type": "VState:EventLoggedField",
    "rdfs:subPropertyOf": "V:target",
    "rdfs:domain": "V:Relation",
    "rdfs:range": "V:SourceredNode",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "VState:coupledToField": "V:pairedInRelation",
    "rdfs:comment":
`The paired target node of this relation (the coupled field
'pairedInRelation' is an event logged field).`,
  },

  // Note: 'pairedInRelation' has domain SourceredNode but is listed
  // here due to its coupling with 'pairedTarget'.
  pairedInRelation: {
    "@type": "VState:EventLoggedField",
    "rdfs:subPropertyOf": "V:incomingRelations",
    "rdfs:domain": "V:SourceredNode",
    "rdfs:range": "rdfs:List",
    "VState:coupledToField": "V:pairedTarget",
    "rdfs:comment":
`The ordered list of incoming relations paired to this sourcered node.`,
  },

  graphSource: {
    "@type": "VState:EventLoggedField",
    "rdfs:subPropertyOf": ["V:graph", "V:pairedSource"],
    "rdfs:domain": "V:Relation",
    "rdfs:range": "V:SourceredNode",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "VState:isOwnedBy": true,
    "VState:coupledToField": "V:ownsOutRelation",
    "rdfs:comment":
`The source and also the graph node of this relation.`,
  },

  // Note: 'ownsOutRelation' has domain SourceredNode but is listed
  // here due to its coupling with 'graphSource'.
  ownsOutRelation: {
    "@type": "VState:EventLoggedField",
    "rdfs:subPropertyOf": ["V:ownsRelation", "V:pairedOutRelation"],
    "rdfs:domain": "V:SourceredNode",
    "rdfs:range": "rdfs:List",
    "VState:isOwnerOf": true,
    "VState:coupledToField": "V:graphSource",
    "rdfs:comment":
`The ordered list of outgoing relations contained in (and owned by)
this sourcered node.`,
  },

  graphTarget: {
    "@type": "VState:EventLoggedField",
    "rdfs:subPropertyOf": ["V:graph", "V:pairedTarget"],
    "rdfs:domain": "V:Relation",
    "rdfs:range": "V:SourceredNode",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "VState:isOwnedBy": true,
    "VState:coupledToField": "V:ownsInRelation",
    "rdfs:comment":
`The node that is both the target and the graph of this relation.`,
  },

  // Note: 'ownsInRelation' has domain SourceredNode but is
  // listed here due to its coupling with 'graphTarget'.
  ownsInRelation: {
    "@type": "VState:EventLoggedField",
    "rdfs:subPropertyOf": ["V:ownsRelation", "V:pairedInRelation"],
    "rdfs:domain": "V:SourceredNode",
    "rdfs:range": "rdfs:List",
    "VState:isOwnerOf": true,
    "VState:coupledToField": "V:graphTarget",
    "rdfs:comment":
`The ordered list of incoming relations contained in (and owned by)
this sourcered node.`,
  },

  // Deprecated fields

  relations: {
    "@type": "VState:AliasField",
    "VRevdoc:deprecatedInFavorOf": "V:ownsRelation",
    "VState:aliasOf": "V:ownsRelation",
    "rdfs:subPropertyOf": "V:ownsRelation",
    "rdfs:domain": "V:SourceredNode",
    "rdfs:range": "rdfs:List",
    "VState:isOwnerOf": true,
    "VState:coupledToField": "V:graph",
    "rdfs:comment":
`A deprecation of V:ownsRelation; the ordered list of
relations contained within this sourcered node when seen as a graph.
Do note that the semantics have changed: ownsRelation can now
also contain relations which have this sourcered node as their the
target (instead of source) or as neither source nor target.
The set of just outgoing relations is 'outgoingRelations' and the set
of owned outgoing relations is 'ownsOutRelation'.`,
  },

  outgoingRelations: {
    "@type": "VState:AliasField",
    "VRevdoc:deprecatedInFavorOf": "V:outRelation",
    "VState:aliasOf": "V:outRelation",
    "rdfs:subPropertyOf": "V:outRelation",
    "rdfs:domain": "V:SourcerableNode",
    "rdfs:range": "rdfs:List",
    "VState:coupledToField": "V:source",
    "rdfs:comment":
`The unordered list of outgoing relations with this sourcerable
(but possibly absent) node as their source (note that sourcerable and
source are completely separate concepts here).`,
  },

  incomingRelations: {
    "@type": "VState:AliasField",
    "VRevdoc:deprecatedInFavorOf": "V:inRelation",
    "VState:aliasOf": "V:inRelation",
    "rdfs:subPropertyOf": "V:inRelation",
    "rdfs:domain": "V:SourcerableNode",
    "rdfs:range": "rdfs:List",
    "VState:coupledToField": "V:target",
    "rdfs:comment":
`The unordered list of incoming relations with this sourcerable
(but possibly absent) node as their target.`,
  },
};
