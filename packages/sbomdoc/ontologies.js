// @flow

const { extendOntology } = require("@valos/vdoc");

module.exports = extendOntology("VSbomdoc", "https://valospace.org/sbomdoc/0#", {}, {
  Document: { "@type": "rdfs:class", "rdfs:subClassOf": "VDoc:Chapter",
    "rdfs:comment": "A Software Bill of Materials document",
  },
});
