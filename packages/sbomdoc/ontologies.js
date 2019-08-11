// @flow

const { extendOntology } = require("@valos/vdoc");

module.exports = extendOntology("sbomdoc", "https://valospace.org/sbomdoc#", {}, {
  Document: { "@type": "rdfs:class", "rdfs:subClassOf": "vdoc:Chapter",
    "rdfs:comment": "A Software Bill of Materials document",
  },
});
