const { extractee: { em, ref, strong } } = require("@valos/vdoc");

const prefixes = {
  "column#0;VDoc:selectKey": "Prefix",
  "column#1;VDoc:selectValue": "IRI",
};

const vocabulary = {
  "column#0": {
    "VDoc:content": ["rdfs:label"],
    "VDoc:cell": {
      "VDoc:resourceId": "VDoc:selectKey",
      ...ref(em("VDoc:selectKey"), ["#", "VDoc:selectKey"]),
    },
  },
  "column#9;rdfs:comment": {
    "VDoc:content": em("rdfs:comment"),
    "VDoc:wide": true,
  },
};

const context = {
  "column#0;VDoc:selectKey": "Term",
  "column#1;VDoc:selectValue": "Definition",
  "column#2;@id": "@id",
  "column#3;@type": "@type",
  "column#4;@container": "@container",
};

const classes = {
  ...vocabulary,
  "column#1": {
    "VDoc:content": ["rdfs:subClassOf"],
    "VDoc:cell": { "VDoc:words": { "VDoc:selectField": "rdfs:subClassOf" } },
  },
};

const properties = {
  ...vocabulary,
  "column#1;rdfs:domain": "rdfs:domain",
  "column#2;rdfs:range": "rdfs:range",
};

const elements = {
  ...vocabulary,
};

const types = {
  ...vocabulary,
  "column#1": {
    "VDoc:content": ["VRevdoc:brief"],
    "VDoc:cell": strong({ "VDoc:selectField": "VRevdoc:brief" }),
  },
  "column#2": {
    "VDoc:content": ["rdfs:subClassOf"],
    "VDoc:cell": { "VDoc:words": { "VDoc:selectField": "rdfs:subClassOf" } },
  },
};

const fields = {
  ...properties,
  "column#3;@type": "rdf:type",
  "column#4": {
    "VDoc:content": "rdfs:subPropertyOf",
    "VDoc:cell": { "VDoc:words": { "VDoc:selectField": "rdfs:subPropertyOf" } },
  },
  "column#5;VModel:coupledField": "VModel:coupledField",
};

const verbs = {
  ...vocabulary,
  "column#1;@type": "rdf:type",
  "column#2;comment": "Comment",
};

const globals = {
  ...vocabulary,
  "column#1;@type": "rdf:type",
  "column#2;comment": "Comment",
  /*
  "column#5": {
    "VDoc:content": ref("prototype properties", "@valos/engine#Property"),
    "VDoc:wide": true,
    "VDoc:cell": _instancePropertyCell,
  },
  "column#6": {
    "VDoc:content": ref("prototype methods", "@valos/engine#Method"),
    "VDoc:wide": true,
    "VDoc:cell": _instanceMethodCell,
  },
  "column#7": {
    "VDoc:content": ref("object properties", "@valos/engine#ObjectProperty"),
    "VDoc:wide": true,
    "VDoc:cell": _objectPropertyCell,
  },
  "column#8": {
    "VDoc:content": ref("object methods", "@valos/engine#ObjectMethod"),
    "VDoc:wide": true,
    "VDoc:cell": _objectMethodCell,
  },
  */
};

const objectProperties = {
  ...properties,
};

const objectMethods = {
  ...methods,
};

const vocabularyOther = {
  ...vocabulary,
  "column#1;@type": "rdf:type",
  "column#2": {
    "VDoc:content": ["rdfs:subClassOf"],
    "VDoc:cell": { "VDoc:words": { "VDoc:selectField": "rdfs:subClassOf" } },
  },
};

const extractionRules = {
  "column#0;VDoc:selectKey": "Rule name",
  "column#1;range": "Inter-node rdf:type",
  "column#2;owner": "Owner property",
  "column#3;body": "Body property",
  "column#4;rest": "';rest' property",
  "column#5;comment": "Comment",
};

const extractee = {
  "column#0;VDoc:selectKey": "API identifier",
  "column#1;VDoc:selectValue": "rdf:type",
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
