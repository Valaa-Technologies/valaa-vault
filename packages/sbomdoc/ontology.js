// @flow

// const { ontology } = require("~/vdoc");

module.exports = {
  prefix: "sbomdoc",
  prefixIRI: "https://valospace.org/sbomdoc#",

  prefixes: {
    sbomdoc: "https://valospace.org/sbomdoc#",
  },
  context: {
  },
  vocabulary: {
    Document: { a: "rdfs:class", "rdfs:subClassOf": "vdoc:Chapter",
      "rdfs:comment": "A Software Bill of Materials document",
    },
  },
  extractionRules: {},
};
