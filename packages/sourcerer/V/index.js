module.exports = {
  base: require("@valos/kernel/V"),
  extenderModule: "@valos/sourcerer/V",
  namespaceModules: {
    VKernel: "@valos/kernel/VKernel",
    VState: "@valos/state/VState",
    VLog: "@valos/log/VLog",
  },
  vocabulary: {
    ...require("./SourcerableNode"),
    ...require("./UnsourceredNode"),
    ...require("./NonExistentNode"),
    ...require("./SourceredNode"),

    directory: {
      "@type": "VState:EventLoggedField",
      "rdfs:subPropertyOf": "V:container",
      "rdfs:domain": ["V:Entity", "V:Media"],
      "rdfs:range": "V:SourceredNode",
      restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
      "VState:isOwnedBy": true,
      "VState:coupledToField": "V:entries",
      "rdfs:comment":
  `The directory (and owner) node of this sourcered node.`,
    },

    entries: {
      "@type": "VState:EventLoggedField",
      "rdfs:subPropertyOf": "V:nodes",
      "rdfs:domain": "V:SourceredNode",
      "rdfs:range": "rdfs:List",
      "VState:isOwnerOf": true,
      "VState:coupledToField": "V:directory",
      "rdfs:comment":
  `The ordered list of entries of this sourcered node when seen as
  a directory.`,
    },

    ...require("./Entity"),
    ...require("./Media"),
    ...require("./Relation"),
  },
};
