// @flow

// const { ontology } = require("~/type-vault/vdoc");

module.exports = {
  prefix: "sbomdoc",
  base: "https://valaatech.github.io/vault/type-vault/sbomdoc#",

  prefixes: {
    sbomdoc: "https://valaatech.github.io/vault/type-vault/sbomdoc#",
  },
  context: {
  },
  vocabulary: {
    Document: { a: "rdfs:class", "rdfs:subClassOf": "vdoc:Chapter",
      "rdfs:comment": "A Software Bill of Materials document",
    },
  },
  extractionRules: {
  },
};
