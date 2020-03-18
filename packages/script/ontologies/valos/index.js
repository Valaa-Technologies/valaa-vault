module.exports = {
  nameAlias: {
      "@type": "valos_raem:AliasField",
      "valos_raem:aliasOf": "valos:name",
      "rdfs:subPropertyOf": "valos:name",
      "rdfs:domain": "valos:Extant",
      "rdfs:range": "xsd:string",
      restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
      "rdfs:comment":
`The primary name of this resource. It is globally non-unique but often
context-dependently unique.

This is an alias of valos:name for circumventing conflicts with the
native javascript property 'name' in certain execution contexts`,
  },
  prototypeAlias: {
      "@type": "valos_raem:AliasField",
      "valos_raem:aliasOf": "valos:prototype",
      "rdfs:subPropertyOf": "valos:prototype",
      "rdfs:domain": "valos:Extant",
      "rdfs:range": "valos:Resource",
      restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
      "rdfs:comment":
`The prototype of this resource.

This is an alias for valos:prototype to bypass conflicts with native
javascript property 'prototype' in certain execution contexts.`
  },
  ...require("./Property"),
  ...require("./Scope"),
};
