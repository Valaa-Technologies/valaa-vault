// @flow

const { createOntology } = require("@valos/vdoc");

module.exports = createOntology("sbomdoc", "https://valospace.org/sbomdoc#", {
  vocabulary: {
    Document: { "@type": "rdfs:class", "rdfs:subClassOf": "vdoc:Chapter",
      "rdfs:comment": "A Software Bill of Materials document",
    },
  },
});
