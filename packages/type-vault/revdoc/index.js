const vdoc = require("@valos/type-vault/vdoc");
const ontology = require("./ontology");
const extractee = require("./extractee");

module.exports = {
  ...vdoc,
  extractee: {
    ...vdoc.extractee,
    ...extractee,
  },
  ontology,
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
      "column#3;@container": "@container",
    },
    vocabulary: {
      "column#0;vdoc:key": "rdfs:label",
      "column#1;a": "rdf:type",
      "column#2;rdfs:subClassOf": "rdfs:subClassOf",
      "column#3;rdfs:domain": "rdfs:domain",
      "column#4;rdfs:range": "rdfs:range",
      "column#5;rdfs:comment": "rdfs:comment",
    },
    extractionRules: {
      "column#0;vdoc:key": "Rule name",
      "column#1;range": "Node rdf:type",
      "column#2;target": "primary target",
      "column#3;rest": "';rest' target",
      "column#4;comment": "Comment",
    },
    extracteeAPI: {
      "column#0;vdoc:key": "API identifier",
      "column#1;vdoc:value": "rdf:type",
    },
  },
  extract (sourceGraphs, options = {}) {
    if (options.ontologies === undefined) options.ontologies = [ontology, vdoc.ontology];
    return vdoc.extract(sourceGraphs, options);
  },
  emit (emission, vdocson, formatName, ontologies = [ontology, vdoc.ontology]) {
    return vdoc.emit(emission, vdocson, formatName, ontologies);
  },
};
