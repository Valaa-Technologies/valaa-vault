const { extractee: { em, ref, strong } } = require("@valos/vdoc");

const prefixes = {
  "header#0;VDoc:selectKey": "Prefix",
  "header#1;VDoc:selectValue": "IRI",
};

const vocabulary = {
  "header#0": {
    "VDoc:content": ["rdfs:label"],
    "VDoc:cell": {
      "VDoc:resourceId": "VDoc:selectKey",
      ...ref(em("VDoc:selectKey"), ["#", "VDoc:selectKey"]),
    },
  },
  "header#9;rdfs:comment": {
    "VDoc:content": em("rdfs:comment"),
    "VDoc:wide": true,
  },
};

const context = {
  "header#0;VDoc:selectKey": "Term",
  "header#1;VDoc:selectValue": "Definition",
  "header#2;@id": "@id",
  "header#3;@type": "@type",
  "header#4;@container": "@container",
};

const classes = {
  ...vocabulary,
  "header#1": {
    "VDoc:content": ["rdfs:subClassOf"],
    "VDoc:cell": { "VDoc:words": { "VDoc:selectField": "rdfs:subClassOf" } },
  },
};

const properties = {
  ...vocabulary,
  "header#1;rdfs:subPropertyOf": "rdfs:subPropertyOf",
  "header#2;rdfs:domain": "rdfs:domain",
  "header#3;rdfs:range": "rdfs:range",
};

const elements = {
  ...vocabulary,
};

const types = {
  ...vocabulary,
  "header#1": {
    "VDoc:content": ["VRevdoc:brief"],
    "VDoc:cell": strong({ "VDoc:selectField": "VRevdoc:brief" }),
  },
  "header#2": {
    "VDoc:content": ["rdfs:subClassOf"],
    "VDoc:cell": { "VDoc:words": { "VDoc:selectField": "rdfs:subClassOf" } },
  },
};

const fields = {
  ...vocabulary,
  "header#1;rdfs:domain": "rdfs:domain",
  "header#2;rdfs:range": "rdfs:range",
  "header#3;@type": "rdf:type",
  "header#4;rdfs:subPropertyOf": "rdfs:subPropertyOf",
  "header#5;VModel:coupledField": "VModel:coupledField",
};

const verbs = {
  ...vocabulary,
  "header#1;@type": "rdf:type",
  "header#2;comment": "Comment",
};

const vocabularyOther = {
  ...vocabulary,
  "header#1;@type": "rdf:type",
  "header#2": {
    "VDoc:content": ["rdfs:subClassOf"],
    "VDoc:cell": { "VDoc:words": { "VDoc:selectField": "rdfs:subClassOf" } },
  },
};

const extractionRules = {
  "header#0;VDoc:selectKey": "Rule name",
  "header#1;range": "Inter-node rdf:type",
  "header#2;owner": "Owner property",
  "header#3;body": "Body property",
  "header#4;rest": "';rest' property",
  "header#5;comment": "Comment",
};

const extractee = {
  "header#0;VDoc:selectKey": "API identifier",
  "header#1;VDoc:selectValue": "rdf:type",
};

module.exports = {
  prefixes,

  vocabulary,
  classes,
  properties,
  elements,
  types,
  fields,
  verbs,
  vocabularyOther,

  extractionRules,
  extractee,

  context,
};
