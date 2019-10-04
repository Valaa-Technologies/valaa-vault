module.exports = {
  ...require("./SourcerableNode"),
  ...require("./UnsourceredNode"),
  ...require("./NonExistentNode"),
  ...require("./SourceredNode"),

  directory: {
    "@type": "valos-raem:EventLoggedField",
    "rdfs:subPropertyOf": "valos:container",
    "rdfs:domain": ["valos:Entity", "valos:Media"],
    "rdfs:range": "valos:SourceredNode",
    restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
    "valos-raem:isOwnedBy": true,
    "valos-raem:coupledField": "valos:entries",
    "rdfs:comment":
`The directory (and owner) node of this sourcered node.`,
  },

  entries: {
    "@type": "valos-raem:EventLoggedField",
    "rdfs:subPropertyOf": "valos:nodes",
    "rdfs:domain": "valos:SourceredNode",
    "rdfs:range": "rdfs:List",
    "valos-raem:isOwnerOf": true,
    "valos-raem:coupledField": "valos:directory",
    "rdfs:comment":
`The ordered list of entries of this sourcered node when seen as
a directory.`,
  },

  ...require("./Entity"),
  ...require("./Media"),
  ...require("./Relation"),
};
