const extendOntology = require("@valos/vdoc/extendOntology");

module.exports = extendOntology({
  "@context": {
    VKernel: "https://valospace.org/kernel/0#",
    VDoc: "https://valospace.org/vdoc/0#",
    VRevdoc: "https://valospace.org/revdoc/0#",
    restriction: { "@reverse": "owl:onProperty" },
  },
  ontology: { "@type": "owl:Ontology",
    "rdfs:label": "VSbomdoc",
    "rdf:about": "https://valospace.org/sbomdoc/0#",
    "rdfs:comment":
`VSbomdoc ontology provides vocabulary and definitions which are
tailored for representing CycloneDX SBoM analysis semantic content.`,
  },

  Document: { "@type": "rdfs:class", "rdfs:subClassOf": "VDoc:Chapter",
    "rdfs:comment": "A Software Bill of Materials document",
  },
});
