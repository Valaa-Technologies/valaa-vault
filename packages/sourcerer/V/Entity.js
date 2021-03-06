module.exports = {
  Entity: {
    "@type": "VState:Type",
    "VRevdoc:brief": "primary resource tree node type",
    "rdfs:subClassOf": [
      "V:Resource", "V:Extant", "V:Scope",
      "V:SourcerableNode", "V:SourceredNode",
    ],
    "rdfs:comment":
`The class of valospace resources which act as the main valospace tree
hierarchy building block. With Relation and Media it forms the group of
three primary node types. As a Scope it can have scriptable properties,
which entities expose to all child resources as their lexical scripting
namespace.

The set of valospace tree hierarchies is defined via triple pattern:

  SELECT ?root ?parent ?node WHERE {
    ?node V:parent ?parent .
    ?parent V:parent* ?root .
    NOT EXISTS ( ?root V:parent ?rootParent )
  }

This implies that only Entity resources can be nodes but any primary
node can act as a root resource.
`,
  },

  parent: {
    "@type": "VState:EventLoggedField",
    "rdfs:subPropertyOf": "V:directory",
    "rdfs:domain": "V:Entity",
    "rdfs:range": "V:SourceredNode",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "VState:isOwnedBy": true,
    "VState:linkedToField": "V:ownsEntity",
    "rdfs:comment":
`The parent (and directory, owner) node of this entity.`,
  },

  // Note: 'entities' has domain SourceredNode but is listed
  // here due to its coupling with 'parent'.
  ownsEntity: {
    "@type": "VState:EventLoggedField",
    "rdfs:subPropertyOf": "V:entries",
    "rdfs:domain": "V:SourceredNode",
    "rdfs:range": "rdfs:List",
    "VState:isOwnerOf": true,
    "VState:linkedToField": "V:parent",
    "rdfs:comment":
`The ordered list of entities contained in this sourcered node.`,
  },
};
