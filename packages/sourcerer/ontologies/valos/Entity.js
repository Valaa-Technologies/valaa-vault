module.exports = {
  Entity: {
    "@type": "valos-raem:Type",
    "revdoc:brief": "primary resource hierachy node type",
    "rdfs:subClassOf": [
      "valos:Resource", "valos:Sourced",
      "valos:ScriptResource", "valos:Scope", "valos:Relatable",
      "valos:Partition",
    ],
    "rdfs:comment":
`The class of valospace resources which act as the main valospace
hierarchy building block. With Relation and Media it forms the group of
three primary types. As a Scope it can have scriptable properties,
which entities expose to all child resources as their lexical scripting
namespace.
`,
  },

  parent: {
    "@type": "valos-raem:AliasField",
    "valos-raem:aliasOf": "valos:directory",
    "rdfs:subPropertyOf": "valos:directory",
    "rdfs:domain": "valos:Entity",
    "rdfs:range": "valos:Relatable",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos-raem:isOwnedBy": true,
    "valos-raem:coupledField": "valos:children",
    "rdfs:comment":
`The parent (and owner) relatable of this entity.`,
  },

  // Note: 'children' has domain Relatable but is listed here.
  children: {
    "@type": "valos-raem:AliasField",
    "valos-raem:aliasOf": "valos:entries",
    "rdfs:subPropertyOf": "valos:entries",
    "rdfs:domain": "valos:Relatable",
    "rdfs:range": "rdfs:List",
    "valos-raem:isOwnerOf": true,
    "valos-raem:coupledField": "valos:parent",
    "rdfs:comment":
`The ordered list of child entities of this relatable`,
  },
};
