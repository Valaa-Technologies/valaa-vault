const extendOntology = require("@valos/vdoc/extendOntology");

module.exports = extendOntology({
  "@context": {
    VKernel: "https://valospace.org/kernel/0#",
    restriction: { "@reverse": "owl:onProperty" },
  },
  ontology: { "@type": "owl:Ontology",
    "rdfs:label": "VTwindoc",
    "rdf:about": "https://valospace.org/twindoc/0#",
    "rdfs:comment":
`VTwindoc ontology provides vocabulary for defining hypertwin mappings
and configurations; actual hypertwin content is represented using the
valos core ontologies and possible extension content ontologies.`,
  },
});
