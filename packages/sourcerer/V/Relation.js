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
    "VState:linkedToField": "V:ownsRelation",
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
    "VState:linkedToField": "V:graph",
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
    "VState:coupledToField": "V:hasOutRelation",
    "rdfs:comment":
`The source node of this relation.`,
  },

  // Note: 'outgoingRelations' has domain SourcerableNode but is listed
  // here due to its coupling with 'source'.
  hasOutRelation: {
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
    "VState:coupledToField": "V:hasInRelation",
    "rdfs:comment":
`The target node of this relation.`,
  },

  // Note: 'incomingRelations' has domain SourcerableNode but is listed
  // here due to its coupling with 'source'.
  hasInRelation: {
    "@type": "VState:CoupledField",
    "rdfs:subPropertyOf": "V:nodes",
    "rdfs:domain": "V:SourcerableNode",
    "rdfs:range": "rdfs:List",
    "VState:coupledToField": "V:target",
    "rdfs:comment":
`The unordered list of incoming relations with this sourcerable
(but possibly absent) node as their target.`,
  },

  linkedSource: {
    "@type": "VState:EventLoggedField",
    "rdfs:subPropertyOf": "V:source",
    "rdfs:domain": "V:Relation",
    "rdfs:range": "V:SourceredNode",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "VState:linkedToField": "V:linkedOutRelation",
    "rdfs:comment":
`The backlinked source node of this relation. Backlinking implies
that the coupled field 'linkedOutRelation' is an event logged field and
shall be transactionally modified whenever this field is modified.`,
  },

  // Note: 'linkedOutRelation' has domain SourceredNode but is listed
  // here due to its coupling with 'linkedSource'.
  linkedOutRelation: {
    "@type": "VState:EventLoggedField",
    "rdfs:subPropertyOf": "V:outgoingRelations",
    "rdfs:domain": "V:SourceredNode",
    "rdfs:range": "rdfs:List",
    "VState:linkedToField": "V:linkedSource",
    "rdfs:comment":
`The ordered list of outgoing backlinked relations to this sourcered
node.`,
  },

  linkedTarget: {
    "@type": "VState:EventLoggedField",
    "rdfs:subPropertyOf": "V:target",
    "rdfs:domain": "V:Relation",
    "rdfs:range": "V:SourceredNode",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "VState:linkedToField": "V:linkedInRelation",
    "rdfs:comment":
`The backlinked target node of this relation. Backlinking implies
that the coupled field 'linkedInRelation' is an event logged field and
shall be transactionally modified whenever this field is modified.`,
  },

  // Note: 'linkedInRelation' has domain SourceredNode but is listed
  // here due to its coupling with 'linkedTarget'.
  linkedInRelation: {
    "@type": "VState:EventLoggedField",
    "rdfs:subPropertyOf": "V:incomingRelations",
    "rdfs:domain": "V:SourceredNode",
    "rdfs:range": "rdfs:List",
    "VState:linkedToField": "V:linkedTarget",
    "rdfs:comment":
`The ordered list of incoming relations paired to this sourcered node.`,
  },

  ownerSource: {
    "@type": "VState:EventLoggedField",
    "rdfs:subPropertyOf": ["V:graph", "V:linkedSource"],
    "rdfs:domain": "V:Relation",
    "rdfs:range": "V:SourceredNode",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "VState:isOwnedBy": true,
    "VState:linkedToField": "V:ownsOutRelation",
    "rdfs:comment":
`The resource that is both the source and the owner of this relation.`,
  },

  // Note: 'ownsOutRelation' has domain SourceredNode but is listed
  // here due to its coupling with 'ownerSource'.
  ownsOutRelation: {
    "@type": "VState:EventLoggedField",
    "rdfs:subPropertyOf": ["V:ownsRelation", "V:linkedOutRelation"],
    "rdfs:domain": "V:SourceredNode",
    "rdfs:range": "rdfs:List",
    "VState:isOwnerOf": true,
    "VState:linkedToField": "V:ownerSource",
    "rdfs:comment":
`The ordered list of outgoing relations contained in (and owned by)
this sourcered node.`,
  },

  ownerTarget: {
    "@type": "VState:EventLoggedField",
    "rdfs:subPropertyOf": ["V:graph", "V:linkedTarget"],
    "rdfs:domain": "V:Relation",
    "rdfs:range": "V:SourceredNode",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "VState:isOwnedBy": true,
    "VState:linkedToField": "V:ownsInRelation",
    "rdfs:comment":
`The resource that is both the target and the owner of this relation.`,
  },

  // Note: 'ownsInRelation' has domain SourceredNode but is
  // listed here due to its coupling with 'ownerTarget'.
  ownsInRelation: {
    "@type": "VState:EventLoggedField",
    "rdfs:subPropertyOf": ["V:ownsRelation", "V:linkedInRelation"],
    "rdfs:domain": "V:SourceredNode",
    "rdfs:range": "rdfs:List",
    "VState:isOwnerOf": true,
    "VState:linkedToField": "V:ownerTarget",
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
    "VRevdoc:deprecatedInFavorOf": "V:hasOutRelation",
    "VState:aliasOf": "V:hasOutRelation",
    "rdfs:subPropertyOf": "V:hasOutRelation",
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
    "VRevdoc:deprecatedInFavorOf": "V:hasInRelation",
    "VState:aliasOf": "V:hasInRelation",
    "rdfs:subPropertyOf": "V:hasInRelation",
    "rdfs:domain": "V:SourcerableNode",
    "rdfs:range": "rdfs:List",
    "VState:coupledToField": "V:target",
    "rdfs:comment":
`The unordered list of incoming relations with this sourcerable
(but possibly absent) node as their target.`,
  },
};
