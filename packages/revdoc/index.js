const vdoc = require("@valos/vdoc");
const extractee = require("./extractee");

module.exports = {
  extension: {
    ...vdoc.extension,
    extends: [vdoc.extension],
    ontology: require("./ontology"),
    extractors: require("./extractors"),
    emitters: require("./emitters"),
    extractee,
  },
  extractee: {
    ...vdoc.extractee,
    ...extractee,
  },
  ontologyTables: {
    prefixes: {
      "header#0;vdoc:key": "Prefix",
      "header#1;vdoc:value": "IRI",
    },
    context: {
      "header#0;vdoc:key": "Term",
      "header#1;vdoc:value": "Definition",
      "header#2;@id": "@id",
      "header#3;@type": "@type",
      "header#4;@container": "@container",
    },
    vocabulary: {
      "header#0;vdoc:id": "rdfs:label",
      "header#1;a": "rdf:type",
      "header#2;rdfs:comment": "rdfs:comment",
    },
    properties: {
      "header#0;vdoc:id": "rdfs:label",
      "header#1;rdfs:subPropertyOf": "rdfs:subPropertyOf",
      "header#2;rdfs:domain": "rdfs:domain",
      "header#3;rdfs:range": "rdfs:range",
      "header#4;rdfs:comment": "rdfs:comment",
    },
    classes: {
      "header#0;vdoc:id": "rdfs:label",
      "header#1;rdfs:subClassOf": "rdfs:subClassOf",
      "header#2;rdfs:comment": "rdfs:comment",
    },
    extractionRules: {
      "header#0;vdoc:key": "Rule name",
      "header#1;range": "Node rdf:type",
      "header#2;target": "primary target",
      "header#3;rest": "';rest' target",
      "header#4;comment": "Comment",
    },
    extractee: {
      "header#0;vdoc:key": "API identifier",
      "header#1;vdoc:value": "rdf:type",
    },
  },
};
