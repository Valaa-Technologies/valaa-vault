module.exports = {
  directory: {
    "@type": "valos-raem:AliasField",
    "valos-raem:aliasOf": "valos:owner",
    "rdfs:subPropertyOf": "valos:owner",
    "rdfs:domain": ["valos:Entity", "valos:Media"],
    "rdfs:range": "rdfs:Relatable",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos-raem:isOwnedBy": true,
    "valos-raem:coupledField": "valos:entries",
    "rdfs:comment":
`The directory (and owner) relatable of this entry resource.`,
  },

  entries: {
    "@type": "valos-raem:AliasField",
    "valos-raem:aliasOf": "valos:ownlings",
    "rdfs:subPropertyOf": "valos:ownlings",
    "rdfs:domain": "valos:Relatable",
    "rdfs:range": "rdfs:List",
    "valos-raem:isOwnerOf": true,
    "valos-raem:coupledField": "valos:directory",
    "rdfs:comment":
`The ordered list of entry entities and medias of this relatable.`,
  },
  ...require("./Entity"),
  ...require("./Media"),
};
