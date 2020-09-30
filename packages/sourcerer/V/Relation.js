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

  connector: {
    "@type": "VState:EventLoggedField",
    "rdfs:subPropertyOf": "V:container",
    "rdfs:domain": "V:Relation",
    "rdfs:range": "V:SourceredNode",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "VState:isOwnedBy": true,
    "VState:coupledToField": "V:connectedRelations",
    "rdfs:comment":
`The connector (and container, owner) node of this relation.
Typically also either the source or the target but possibly neither.`,
  },

  // Note: 'connectedRelations' has domain SourceredNode but is listed
  // here due to its coupling with 'connector'.
  connectedRelations: {
    "@type": "VState:EventLoggedField",
    "rdfs:subPropertyOf": "V:nodes",
    "rdfs:domain": "V:SourceredNode",
    "rdfs:range": "rdfs:List",
    "VState:isOwnerOf": true,
    "VState:coupledToField": "V:connector",
    "rdfs:comment":
`The ordered list of relations that are connected (and contained,
owned) _by_ this sourcered node. This includes both
connectedInRelations and connectedOutRelations (ie. incoming and
outgoing relations which are also connected by this sourcered node) but
also relations which only have this sourcered node as their connector
but not as source or target.`,
  },

  source: {
    "@type": "VState:EventLoggedField",
    "rdfs:subPropertyOf": "rdf:subject",
    "rdfs:domain": "V:Relation",
    "rdfs:range": "V:SourceredNode",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "VState:coupledToField": "V:outRelations",
    "rdfs:comment":
`The source node of this relation.`,
  },

  // Note: 'outgoingRelations' has domain SourcerableNode but is listed
  // here due to its coupling with 'source'.
  outRelations: {
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
    "VState:coupledToField": "V:inRelations",
    "rdfs:comment":
`The target node of this relation.`,
  },

  // Note: 'incomingRelations' has domain SourcerableNode but is listed
  // here due to its coupling with 'source'.
  inRelations: {
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
    "VState:coupledToField": "V:pairedOutRelations",
    "rdfs:comment":
`The paired source node of this relation (paired denotes that the
coupled field 'pairedOutRelations' is an event logged field).`,
  },

  // Note: 'pairedOutRelations' has domain SourceredNode but is listed
  // here due to its coupling with 'pairedSource'.
  pairedOutRelations: {
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
    "VState:coupledToField": "V:pairedInRelations",
    "rdfs:comment":
`The paired target node of this relation (the coupled field
'pairedInRelations' is an event logged field).`,
  },

  // Note: 'pairedInRelations' has domain SourceredNode but is listed
  // here due to its coupling with 'pairedTarget'.
  pairedInRelations: {
    "@type": "VState:EventLoggedField",
    "rdfs:subPropertyOf": "V:incomingRelations",
    "rdfs:domain": "V:SourceredNode",
    "rdfs:range": "rdfs:List",
    "VState:coupledToField": "V:pairedTarget",
    "rdfs:comment":
`The ordered list of incoming relations paired to this sourcered node.`,
  },

  connectedSource: {
    "@type": "VState:EventLoggedField",
    "rdfs:subPropertyOf": ["V:connector", "V:pairedSource"],
    "rdfs:domain": "V:Relation",
    "rdfs:range": "V:SourceredNode",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "VState:isOwnedBy": true,
    "VState:coupledToField": "V:connectedOutRelations",
    "rdfs:comment":
`The source and also the connector node of this relation.`,
  },

  // Note: 'connectedOutRelations' has domain SourceredNode but is listed
  // here due to its coupling with 'connectedSource'.
  connectedOutRelations: {
    "@type": "VState:EventLoggedField",
    "rdfs:subPropertyOf": ["V:connectedRelations", "V:pairedOutRelations"],
    "rdfs:domain": "V:SourceredNode",
    "rdfs:range": "rdfs:List",
    "VState:isOwnerOf": true,
    "VState:coupledToField": "V:connectedSource",
    "rdfs:comment":
`The ordered list of outgoing relations contained in (and owned by)
this sourcered node.`,
  },

  connectedTarget: {
    "@type": "VState:EventLoggedField",
    "rdfs:subPropertyOf": ["V:connector", "V:pairedTarget"],
    "rdfs:domain": "V:Relation",
    "rdfs:range": "V:SourceredNode",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "VState:isOwnedBy": true,
    "VState:coupledToField": "V:connectedInRelations",
    "rdfs:comment":
`The target and also the connector node of this relation.`,
  },

  // Note: 'connectedInRelations' has domain SourceredNode but is
  // listed here due to its coupling with 'connectedTarget'.
  connectedInRelations: {
    "@type": "VState:EventLoggedField",
    "rdfs:subPropertyOf": ["V:connectedRelations", "V:pairedInRelations"],
    "rdfs:domain": "V:SourceredNode",
    "rdfs:range": "rdfs:List",
    "VState:isOwnerOf": true,
    "VState:coupledToField": "V:connectedTarget",
    "rdfs:comment":
`The ordered list of incoming relations contained in (and owned by)
this sourcered node.`,
  },

  // Deprecated fields

  relations: {
    "@type": "VState:AliasField",
    "VRevdoc:deprecatedInFavorOf": "V:connectedRelations",
    "VState:aliasOf": "V:connectedRelations",
    "rdfs:subPropertyOf": "V:connectedRelations",
    "rdfs:domain": "V:SourceredNode",
    "rdfs:range": "rdfs:List",
    "VState:isOwnerOf": true,
    "VState:coupledToField": "V:connector",
    "rdfs:comment":
`A deprecation of V:connectedRelations; the ordered list of
relations contained within this sourcered node when seen as a graph.
Do note that the semantics have changed: connectedRelations can now
also contain relations which have this sourcered node as their the
target (instead of source) or as neither source nor target.
The set of just outgoing relations is 'outgoingRelations' and the set
of owned outgoing relations is 'connectedOutRelations'.`,
  },

  outgoingRelations: {
    "@type": "VState:AliasField",
    "VRevdoc:deprecatedInFavorOf": "V:outRelations",
    "VState:aliasOf": "V:outRelations",
    "rdfs:subPropertyOf": "V:outRelations",
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
    "VRevdoc:deprecatedInFavorOf": "V:inRelations",
    "VState:aliasOf": "V:inRelations",
    "rdfs:subPropertyOf": "V:inRelations",
    "rdfs:domain": "V:SourcerableNode",
    "rdfs:range": "rdfs:List",
    "VState:coupledToField": "V:target",
    "rdfs:comment":
`The unordered list of incoming relations with this sourcerable
(but possibly absent) node as their target.`,
  },
};
