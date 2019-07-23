// @flow

// const { ontology } = require("~/vdoc");

module.exports = {
  prefix: "sbomdoc",
  base: "https://valospace.org/kernel/sbomdoc#",

  prefixes: {
    sbomdoc: "https://valospace.org/kernel/sbomdoc#",
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
