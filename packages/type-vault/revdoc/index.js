const vdoc = require("@valos/type-vault/vdoc");
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
      "column#0;vdoc:key": "Prefix",
      "column#1;vdoc:value": "IRI",
    },
    context: {
      "column#0;vdoc:key": "Term",
      "column#1;vdoc:value": "Definition",
      "column#2;@id": "@id",
      "column#3;@type": "@type",
      "column#4;@container": "@container",
    },
    vocabulary: {
      "column#0;vdoc:key": "rdfs:label",
      "column#1;a": "rdf:type",
      "column#2;rdfs:subClassOf": "rdfs:subClassOf",
      "column#3;rdfs:subPropertyOf": "rdfs:subPropertyOf",
      "column#4;rdfs:domain": "rdfs:domain",
      "column#5;rdfs:range": "rdfs:range",
      "column#6;rdfs:comment": "rdfs:comment",
    },
    extractionRules: {
      "column#0;vdoc:key": "Rule name",
      "column#1;range": "Node rdf:type",
      "column#2;target": "primary target",
      "column#3;rest": "';rest' target",
      "column#4;comment": "Comment",
    },
    extractee: {
      "column#0;vdoc:key": "API identifier",
      "column#1;vdoc:value": "rdf:type",
    },
  },
};
