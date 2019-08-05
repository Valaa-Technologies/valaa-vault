const { extractee: { aggregate, em, ref } } = require("@valos/vdoc");

const vocabulary = {
  "header#0": {
    "vdoc:content": ["rdfs:label"],
    "vdoc:cell": {
      "vdoc:resourceId": "vdoc:selectKey",
      ...ref(em("vdoc:selectKey"), ["#", "vdoc:selectKey"]),
    },
  },
  "header#9;rdfs:comment": {
    "vdoc:content": ["rdfs:comment"],
    "vdoc:wide": true,
  },
};

module.exports = {
  prefixes: {
    "header#0;vdoc:selectKey": "Prefix",
    "header#1;vdoc:selectValue": "IRI",
  },
  context: {
    "header#0;vdoc:selectKey": "Term",
    "header#1;vdoc:selectValue": "Definition",
    "header#2;@id": "@id",
    "header#3;@type": "@type",
    "header#4;@container": "@container",
  },
  vocabulary,
  classes: {
    ...vocabulary,
    "header#1": {
      "vdoc:content": ["rdfs:subClassOf"],
      "vdoc:cell": { "vdoc:words": { "vdoc:selectField": "rdfs:subClassOf" } },
    },
  },
  properties: {
    ...vocabulary,
    "header#1;rdfs:subPropertyOf": "rdfs:subPropertyOf",
    "header#2;rdfs:domain": "rdfs:domain",
    "header#3;rdfs:range": "rdfs:range",
  },
  elements: {
    ...vocabulary,
  },
  types: {
    ...vocabulary,
    "header#1": {
      "vdoc:content": ["rdfs:subClassOf"],
      "vdoc:cell": { "vdoc:words": { "vdoc:selectField": "rdfs:subClassOf" } },
    },
  },
  fields: {
    ...vocabulary,
    "header#1;rdfs:domain": "rdfs:domain",
    "header#2;rdf:type": "rdf:type",
    "header#3;rdfs:subPropertyOf": "rdfs:subPropertyOf",
    "header#4;rdfs:range": "rdfs:range",
    "header#5;valos:coupledField": "valos:coupledField",
  },
  vocabularyOther: {
    ...vocabulary,
    "header#1;rdf:type": "rdf:type",
    "header#2": {
      "vdoc:content": ["rdfs:subClassOf"],
      "vdoc:cell": { "vdoc:words": { "vdoc:selectField": "rdfs:subClassOf" } },
    },
  },
  extractionRules: {
    "header#0;vdoc:selectKey": "Rule name",
    "header#1;range": "Inter-node rdf:type",
    "header#2;owner": "Owner property",
    "header#3;body": "Body property",
    "header#4;rest": "';rest' property",
    "header#5;comment": "Comment",
  },
  extractee: {
    "header#0;vdoc:selectKey": "API identifier",
    "header#1;vdoc:selectValue": "rdf:type",
  },
};
