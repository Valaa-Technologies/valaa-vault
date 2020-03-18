module.exports = {
  Entity: {
    "@type": "valos_raem:Type",
    "revdoc:brief": "primary resource tree node type",
    "rdfs:subClassOf": [
      "valos:Resource", "valos:Extant", "valos:Scope",
      "valos:SourcerableNode", "valos:SourceredNode",
    ],
    "rdfs:comment":
`The class of valospace resources which act as the main valospace tree
hierarchy building block. With Relation and Media it forms the group of
three primary node types. As a Scope it can have scriptable properties,
which entities expose to all child resources as their lexical scripting
namespace.

The set of valospace tree hierarchies is defined via triple pattern:

  SELECT ?root ?parent ?node WHERE {
    ?node valos:parent ?parent .
    ?parent valos:parent* ?root .
    NOT EXISTS ( ?root valos:parent ?rootParent )
  }

This implies that only Entity resources can be nodes but any primary
node can act as a root resource.
`,
  },

  parent: {
    "@type": "valos_raem:EventLoggedField",
    "rdfs:subPropertyOf": "valos:directory",
    "rdfs:domain": "valos:Entity",
    "rdfs:range": "valos:SourceredNode",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos_raem:isOwnedBy": true,
    "valos_raem:coupledField": "valos:entities",
    "rdfs:comment":
`The parent (and directory, owner) node of this entity.`,
  },

  // Note: 'entities' has domain SourceredNode but is listed
  // here due to its coupling with 'parent'.
  entities: {
    "@type": "valos_raem:EventLoggedField",
    "rdfs:subPropertyOf": "valos:entries",
    "rdfs:domain": "valos:SourceredNode",
    "rdfs:range": "rdfs:List",
    "valos_raem:isOwnerOf": true,
    "valos_raem:coupledField": "valos:parent",
    "rdfs:comment":
`The ordered list of entities contained in this sourcered node.`,
  },
};
