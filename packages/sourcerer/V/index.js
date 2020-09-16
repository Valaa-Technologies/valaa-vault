module.exports = {
  base: require("@valos/kernel/V"),
  extenderModule: "@valos/sourcerer/V",
  namespaceModules: {
    VKernel: "@valos/kernel/VKernel",
    VModel: "@valos/raem/VModel",
    VSourcerer: "@valos/sourcerer/VSourcerer",
    V: "@valos/kernel/V",
  },
  vocabulary: {
    ...require("./SourcerableNode"),
    ...require("./UnsourceredNode"),
    ...require("./NonExistentNode"),
    ...require("./SourceredNode"),

    directory: {
      "@type": "VModel:EventLoggedField",
      "rdfs:subPropertyOf": "V:container",
      "rdfs:domain": ["V:Entity", "V:Media"],
      "rdfs:range": "V:SourceredNode",
      restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
      "VModel:isOwnedBy": true,
      "VModel:coupledField": "V:entries",
      "rdfs:comment":
  `The directory (and owner) node of this sourcered node.`,
    },

    entries: {
      "@type": "VModel:EventLoggedField",
      "rdfs:subPropertyOf": "V:nodes",
      "rdfs:domain": "V:SourceredNode",
      "rdfs:range": "rdfs:List",
      "VModel:isOwnerOf": true,
      "VModel:coupledField": "V:directory",
      "rdfs:comment":
  `The ordered list of entries of this sourcered node when seen as
  a directory.`,
    },

    ...require("./Entity"),
    ...require("./Media"),
    ...require("./Relation"),
  },
};
