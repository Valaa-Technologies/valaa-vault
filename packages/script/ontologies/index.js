const { extendOntology } = require("@valos/vdoc");

module.exports = {
  ...extendOntology("valos-script", "https://valospace.org/script#", {}, {}),
  ...extendOntology("valos", "https://valospace.org/#", {
    rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    rdfs: "http://www.w3.org/2000/01/rdf-schema#",
    xsd: "http://www.w3.org/2001/XMLSchema#",
    owl: "http://www.w3.org/2002/07/owl#",
    dc: "http://purl.org/dc/elements/1.1/",
    "valos-kernel": "https://valospace.org/kernel#",
  }, {
    nameAlias: {
      "@type": "valos-raem:AliasField",
      "valos-raem:aliasOf": "valos:name",
      "rdfs:subPropertyOf": "valos:name",
      "rdfs:domain": "valos:Sourced",
      "rdfs:range": "xsd:string",
      restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
      "rdfs:comment":
  `The primary name of this resource. It is globally non-unique but often
  context-dependently unique.
  This is an alias of valos:name for circumventing conflicts with the
  native javascript property 'name' in some execution contexts`,
    },
    prototypeAlias: {
      "@type": "valos-raem:AliasField",
      "valos-raem:aliasOf": "valos:prototype",
      "rdfs:subPropertyOf": "valos:prototype",
      "rdfs:domain": "valos:Resource",
      "rdfs:range": "valos:Resource",
      restriction: { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
      "rdfs:comment":
`The prototype of this resource. This is an alias for valos:prototype
to bypass conflicts with native javascript property 'prototype' in
certain contexts.`
    },
    ...require("./valos/ScriptResource"),
    ...require("./valos/ScriptDestroyed"),
    ...require("./valos/Property"),
    ...require("./valos/Scope"),
    ...require("./valos/Relatable"),
    ...require("./valos/Relation"),
  }, {
    context: {
      restriction: { "@reverse": "owl:onProperty" },
    },
  }),
};
