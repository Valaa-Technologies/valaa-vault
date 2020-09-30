module.exports = {
  base: require("@valos/space/V"),
  extenderModule: "@valos/script/V",
  namespaceModules: {
    VState: "@valos/state/VState",
  },
  vocabulary: {
    nameAlias: {
      "@type": "VState:AliasField",
      "VState:aliasOf": "V:name",
      "rdfs:subPropertyOf": "V:name",
      "rdfs:domain": "V:Extant",
      "rdfs:range": "xsd:string",
      restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
      "rdfs:comment":
`The primary name of this resource. It is globally non-unique but often
context-dependently unique.

This is an alias of V:name for circumventing conflicts with the
native javascript property 'name' in certain execution contexts`,
    },
    prototypeAlias: {
      "@type": "VState:AliasField",
      "VState:aliasOf": "V:prototype",
      "rdfs:subPropertyOf": "V:prototype",
      "rdfs:domain": "V:Extant",
      "rdfs:range": "V:Resource",
      restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
      "rdfs:comment":
`The prototype of this resource.

This is an alias for V:prototype to bypass conflicts with native
javascript property 'prototype' in certain execution contexts.`
    },
    ...require("./Property"),
    ...require("./Scope"),
  },
};
