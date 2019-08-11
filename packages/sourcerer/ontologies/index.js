const { extendOntology } = require("@valos/vdoc");

module.exports = {
  ...extendOntology("valos-sourcerer", "https://valospace.org/sourcerer#", {}, {}),
  ...extendOntology("valos", "https://valospace.org/#", {
    rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    rdfs: "http://www.w3.org/2000/01/rdf-schema#",
    xsd: "http://www.w3.org/2001/XMLSchema#",
    owl: "http://www.w3.org/2002/07/owl#",
    dc: "http://purl.org/dc/elements/1.1/",
    "valos-kernel": "https://valospace.org/kernel#",
  }, {
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

    ...require("./valos/Entity"),
    ...require("./valos/Media"),
  }, {
    context: {
      restriction: { "@reverse": "owl:onProperty" },
    },
  }),
};
