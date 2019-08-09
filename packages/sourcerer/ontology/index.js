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
    directory: {
      "@type": "valos:AliasField",
      "valos:aliasOf": "valos:owner",
      "rdfs:subPropertyOf": "valos:owner",
      "rdfs:domain": ["valos:Entity", "valos:Media"],
      "rdfs:range": "rdfs:Relatable",
      "valos:restriction": { "@type": "owl:Restriction", "owl:maxCardinality": 1 },
      "valos:isOwned": true,
      "valos:coupledField": "valos:entries",
      "rdfs:comment":
`The directory (and owner) relatable of this entry resource.`,
    },

    entries: {
      "@type": "valos:AliasField",
      "valos:aliasOf": "valos:ownlings",
      "rdfs:subPropertyOf": "valos:ownlings",
      "rdfs:domain": "valos:Relatable",
      "rdfs:range": "rdfs:List",
      "valos:isOwning": true,
      "valos:coupledField": "valos:directory",
      "rdfs:comment":
`The ordered list of entry entities and medias of this relatable.`,
    },

    ...require("./Entity"),
    ...require("./Media"),
  },
});
