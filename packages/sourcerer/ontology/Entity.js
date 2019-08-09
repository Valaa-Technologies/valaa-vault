module.exports = {
  Entity: {
    "@type": "valos:Type",
    "rdfs:subClassOf": [
      "valos:TransientFields", "valos:Resource",
      "valos:TransientScriptFields", "valos:Scope", "valos:Relatable",
      "valos:Partition",
    ],
    "revdoc:brief": "entity",
    "rdfs:comment":
`The class of valospace resources which can act as the partition root.`,
  },

  parent: {
    "@type": "valos:AliasField",
    "valos:aliasOf": "valos:directory",
    "rdfs:subPropertyOf": "valos:directory",
    "rdfs:domain": "valos:Entity",
    "rdfs:range": "valos:Relatable",
    "valos:restriction": { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos:isOwned": true,
    "valos:coupledField": "valos:children",
    "rdfs:comment":
`The parent (and owner) relatable of this entity.`,
  },

  // Note: 'children' has domain Relatable but is listed here.
  children: {
    "@type": "valos:AliasField",
    "valos:aliasOf": "valos:entries",
    "rdfs:subPropertyOf": "valos:entries",
    "rdfs:domain": "valos:Relatable",
    "rdfs:range": "rdfs:List",
    "valos:isOwning": true,
    "valos:coupledField": "valos:parent",
    "rdfs:comment":
`The ordered list of child entities of this relatable`,
  },
};
