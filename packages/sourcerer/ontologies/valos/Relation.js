module.exports = {
  Relation: {
    "@type": "valos-raem:Type",
    "rdfs:subClassOf": [
      "valos:Resource", "valos:Extant", "valos:Scope",
      "valos:SourcerableNode", "valos:SourceredNode",
    ],
    "revdoc:brief": "directed relationship node type",
    "rdfs:comment":
`The class of valospace resources which represent directed,
many-to-many relationships between nodes.
With Entity and Media it forms the group of three primary node types.
As a Scope it can have scriptable properties. Relation being
a SourceredNode itself allows for nested and recursive relationship
structures.`,
  },

  connector: {
    "@type": "valos-raem:EventLoggedField",
    "rdfs:subPropertyOf": "valos:container",
    "rdfs:domain": "valos:Relation",
    "rdfs:range": "valos:SourceredNode",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos-raem:isOwnedBy": true,
    "valos-raem:coupledField": "valos:connectedRelations",
    "rdfs:comment":
`The connector (and container, owner) node of this relation.
Typically also either the source or the target but possibly neither.`,
  },

  // Note: 'connectedRelations' has domain SourceredNode but is listed
  // here due to its coupling with 'connector'.
  connectedRelations: {
    "@type": "valos-raem:EventLoggedField",
    "rdfs:subPropertyOf": "valos:nodes",
    "rdfs:domain": "valos:SourceredNode",
    "rdfs:range": "rdfs:List",
    "valos-raem:isOwnerOf": true,
    "valos-raem:coupledField": "valos:connector",
    "rdfs:comment":
`The ordered list of relations that are connected (and contained,
owned) _by_ this sourcered node. This includes both
connectedInRelations and connectedOutRelations (ie. incoming and
outgoing relations which are also connected by this sourcered node) but
also relations which only have this sourcered node as their connector
but not as source or target.`,
  },

  source: {
    "@type": "valos-raem:EventLoggedField",
    "rdfs:subPropertyOf": "rdf:subject",
    "rdfs:domain": "valos:Relation",
    "rdfs:range": "valos:SourceredNode",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos-raem:coupledField": "valos:outgoingRelations",
    "rdfs:comment":
`The source node of this relation.`,
  },

  // Note: 'outgoingRelations' has domain SourcerableNode but is listed
  // here due to its coupling with 'source'.
  outgoingRelations: {
    "@type": "valos-raem:CoupledField",
    "rdfs:subPropertyOf": "valos:nodes",
    "rdfs:domain": "valos:SourcerableNode",
    "rdfs:range": "rdfs:List",
    "valos-raem:coupledField": "valos:source",
    "rdfs:comment":
`The unordered list of outgoing relations with this sourcerable
(but possibly absent) node as their source (note that sourcerable and
source are completely separate concepts here).`,
  },

  target: {
    "@type": "valos-raem:EventLoggedField",
    "rdfs:subPropertyOf": "rdf:object",
    "rdfs:domain": "valos:Relation",
    "rdfs:range": "valos:SourceredNode",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos-raem:coupledField": "valos:incomingRelations",
    "rdfs:comment":
`The target node of this relation.`,
  },

  // Note: 'incomingRelations' has domain SourcerableNode but is listed
  // here due to its coupling with 'source'.
  incomingRelations: {
    "@type": "valos-raem:CoupledField",
    "rdfs:subPropertyOf": "valos:nodes",
    "rdfs:domain": "valos:SourcerableNode",
    "rdfs:range": "rdfs:List",
    "valos-raem:coupledField": "valos:target",
    "rdfs:comment":
`The unordered list of incoming relations with this sourcerable
(but possibly absent) node as their target.`,
  },

  pairedSource: {
    "@type": "valos-raem:EventLoggedField",
    "rdfs:subPropertyOf": "valos:source",
    "rdfs:domain": "valos:Relation",
    "rdfs:range": "valos:SourceredNode",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos-raem:coupledField": "valos:pairedOutRelations",
    "rdfs:comment":
`The paired source node of this relation (paired denotes that the
coupled field 'pairedOutRelations' is an event logged field).`,
  },

  // Note: 'pairedOutRelations' has domain SourceredNode but is listed
  // here due to its coupling with 'pairedSource'.
  pairedOutRelations: {
    "@type": "valos-raem:EventLoggedField",
    "rdfs:subPropertyOf": "valos:outgoingRelations",
    "rdfs:domain": "valos:SourceredNode",
    "rdfs:range": "rdfs:List",
    "valos-raem:coupledField": "valos:pairedSource",
    "rdfs:comment":
`The ordered list of outgoing relations paired to this sourcered node.`,
  },

  pairedTarget: {
    "@type": "valos-raem:EventLoggedField",
    "rdfs:subPropertyOf": "valos:target",
    "rdfs:domain": "valos:Relation",
    "rdfs:range": "valos:SourceredNode",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos-raem:coupledField": "valos:pairedInRelations",
    "rdfs:comment":
`The paired target node of this relation (the coupled field
'pairedInRelations' is an event logged field).`,
  },

  // Note: 'pairedInRelations' has domain SourceredNode but is listed
  // here due to its coupling with 'pairedTarget'.
  pairedInRelations: {
    "@type": "valos-raem:EventLoggedField",
    "rdfs:subPropertyOf": "valos:incomingRelations",
    "rdfs:domain": "valos:SourceredNode",
    "rdfs:range": "rdfs:List",
    "valos-raem:coupledField": "valos:pairedTarget",
    "rdfs:comment":
`The ordered list of incoming relations paired to this sourcered node.`,
  },

  connectorSource: {
    "@type": "valos-raem:EventLoggedField",
    "rdfs:subPropertyOf": ["valos:connector", "valos:pairedSource"],
    "rdfs:domain": "valos:Relation",
    "rdfs:range": "valos:SourceredNode",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos-raem:isOwnedBy": true,
    "valos-raem:coupledField": "valos:connectedOutRelations",
    "rdfs:comment":
`The source and also the connector node of this relation.`,
  },

  // Note: 'connectedOutRelations' has domain SourceredNode but is listed
  // here due to its coupling with 'connectorSource'.
  connectedOutRelations: {
    "@type": "valos-raem:EventLoggedField",
    "rdfs:subPropertyOf": ["valos:connectedRelations", "valos:pairedOutRelations"],
    "rdfs:domain": "valos:SourceredNode",
    "rdfs:range": "rdfs:List",
    "valos-raem:isOwnerOf": true,
    "valos-raem:coupledField": "valos:connectorSource",
    "rdfs:comment":
`The ordered list of outgoing relations contained in (and owned by)
this sourcered node.`,
  },

  connectorTarget: {
    "@type": "valos-raem:EventLoggedField",
    "rdfs:subPropertyOf": ["valos:connector", "valos:pairedTarget"],
    "rdfs:domain": "valos:Relation",
    "rdfs:range": "valos:SourceredNode",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos-raem:isOwnedBy": true,
    "valos-raem:coupledField": "valos:connectedInRelations",
    "rdfs:comment":
`The target and also the connector node of this relation.`,
  },

  // Note: 'connectedInRelations' has domain SourceredNode but is
  // listed here due to its coupling with 'connectorTarget'.
  connectedInRelations: {
    "@type": "valos-raem:EventLoggedField",
    "rdfs:subPropertyOf": ["valos:connectedRelations", "valos:pairedInRelations"],
    "rdfs:domain": "valos:SourceredNode",
    "rdfs:range": "rdfs:List",
    "valos-raem:isOwnerOf": true,
    "valos-raem:coupledField": "valos:connectorTarget",
    "rdfs:comment":
`The ordered list of incoming relations contained in (and owned by)
this sourcered node.`,
  },

  // Deprecated fields

  relations: {
    "@type": "valos-raem:AliasField",
    "revdoc:deprecatedInFavorOf": "valos:connectedRelations",
    "valos-raem:aliasOf": "valos:connectedRelations",
    "rdfs:subPropertyOf": "valos:connectedRelations",
    "rdfs:domain": "valos:SourceredNode",
    "rdfs:range": "rdfs:List",
    "valos-raem:isOwnerOf": true,
    "valos-raem:coupledField": "valos:connector",
    "rdfs:comment":
`A deprecation of valos:connectedRelations; the ordered list of
relations contained within this sourcered node when seen as a graph.
Do note that the semantics have changed: connectedRelations can now
also contain relations which have this sourcered node as their the
target (instead of source) or as neither source nor target.
The set of just outgoing relations is 'outgoingRelations' and the set
of owned outgoing relations is 'connectedOutRelations'.`,
  },
};
