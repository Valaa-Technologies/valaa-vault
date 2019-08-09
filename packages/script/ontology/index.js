const { createOntology } = require("@valos/vdoc");

module.exports = createOntology("valos", "https://valospace.org/#", {
  prefixes: {
    rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    rdfs: "http://www.w3.org/2000/01/rdf-schema#",
    xsd: "http://www.w3.org/2001/XMLSchema#",
    owl: "http://www.w3.org/2002/07/owl#",
    dc: "http://purl.org/dc/elements/1.1/",
    valos: "https://valospace.org/#",
  },
  vocabulary: {
    prototypeAlias: {
      "@type": "valos:AliasField",
      "valos:aliasOf": "valos:prototype",
      "rdfs:subPropertyOf": "valos:prototype",
      "rdfs:domain": "valos:TransientFields",
      "rdfs:range": "valos:TransientFields",
      "valos:restriction": { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
      "rdfs:comment":
`The prototype of this Resource. This is an alias for valos:prototype
to bypass conflicts with native javascript property 'prototype' in
certain contexts.`
    },

    ...require("./TransientScriptFields"),
    ...require("./DestroyedScriptResource"),
    ...require("./Property"),
    ...require("./Scope"),
    ...require("./Relatable"),
    ...require("./Relation"),
  },
});
