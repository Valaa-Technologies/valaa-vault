const { extractee: { em, heading, ref, strong } } = require("@valos/vdoc");

const prefixes = {
  "column#00;VDoc:selectKey": "Prefix",
  "column#01;VDoc:selectValue": "IRI",
};

const vocabulary = {
  "column#00": {
    "VDoc:content": null,
    "VDoc:wide": true,
    "VDoc:cell": {
      "VDoc:resourceId": "VDoc:selectKey",
      ...heading({
        "VDoc:words": [
          strong(em(ref(["#", "VDoc:selectKey"]))),
          {
            "VDoc:words": { "VDoc:selectField": "rdfs:label" },
            "VDoc:elidable": true,
            "VDoc:map": ref("VDoc:selectValue", "VEngine:valosheath"),
          },
        ],
      }),
    },
  },
  "column#01": {
    "VDoc:content": em(strong("DEPRECATED"), " in favor of:"),
    "VDoc:wide": true,
    "VDoc:cell": {
      "VDoc:entries": { "VDoc:selectField": "VRevdoc:deprecatedInFavorOf" },
      "VDoc:elidable": true,
      "VDoc:map": ref("VDoc:selectValue"),
    },
  },
  "column#11;rdfs:comment": {
    "VDoc:content": em(ref("description", "rdfs:comment")),
    "VDoc:wide": true,
  },
  "column#20;VRevdoc:introduction": {
    "VDoc:content": em(ref("introduction", "VRevdoc:introduction")),
    "VDoc:wide": true,
    "VDoc:collapsed": true,
    "VDoc:elidable": true,
  },
};

const context = {
  "column#00;VDoc:selectKey": "Term",
  "column#01;VDoc:selectValue": "Definition",
  "column#02;@id": "@id",
  "column#03;@type": "@type",
  "column#04;@container": "@container",
};

function _simpleReferenceCell (selectedFieldName) {
  return {
    "VDoc:words": { "VDoc:selectField": selectedFieldName },
    "VDoc:map": ref("VDoc:selectValue"),
  };
}

const _instanceFieldCell = {
  "VDoc:words": { "VDoc:selectField": "VEngine:domainOfField" },
  "VDoc:elidable": true,
  "VDoc:map": ref({ "VDoc:selectField": "VRevdoc:indexLabel" }, { "VDoc:selectField": "@id" }),
};
const _instancePropertyCell = {
  "VDoc:words": { "VDoc:selectField": "VEngine:domainOfProperty" },
  "VDoc:elidable": true,
  "VDoc:map": ref({ "VDoc:selectField": "VRevdoc:indexLabel" }, { "VDoc:selectField": "@id" }),
};
const _instanceMethodCell = {
  "VDoc:words": { "VDoc:selectField": "VEngine:domainOfMethod" },
  "VDoc:elidable": true,
  "VDoc:map": ref({ "VDoc:selectField": "VRevdoc:indexLabel" }, { "VDoc:selectField": "@id" }),
};
const _objectPropertyCell = {
  "VDoc:words": { "VDoc:selectField": "VEngine:hasProperty" },
  "VDoc:elidable": true,
  "VDoc:map": ref({ "VDoc:selectField": "VRevdoc:indexLabel" }, { "VDoc:selectField": "@id" }),
};
const _objectMethodCell = {
  "VDoc:words": { "VDoc:selectField": "VEngine:hasMethod" },
  "VDoc:elidable": true,
  "VDoc:map": ref({ "VDoc:selectField": "VRevdoc:indexLabel" }, { "VDoc:selectField": "@id" }),
};

const classes = {
  ...vocabulary,
  "column#02": {
    "VDoc:content": ["rdfs:subClassOf"],
    "VDoc:cell": {
      "VDoc:words": { "VDoc:selectField": "rdfs:subClassOf" },
      "VDoc:map": ref("VDoc:selectValue"),
    },
  },
  "column#11;rdfs:comment": {
    ...vocabulary["column#11;rdfs:comment"],
    "VDoc:wide": false,
  },
  "column#13": {
    "VDoc:content": ref("instance properties", "VEngine:Property"),
    "VDoc:wide": true,
    "VDoc:cell": _instancePropertyCell,
  },
  "column#14": {
    "VDoc:content": ref("instance methods", "VEngine:Method"),
    "VDoc:wide": true,
    "VDoc:cell": _instanceMethodCell,
  },
  "column#15": {
    "VDoc:content": ref("class properties", "VEngine:ObjectProperty"),
    "VDoc:wide": true,
    "VDoc:cell": _objectPropertyCell,
  },
  "column#16": {
    "VDoc:content": ref("class methods", "VEngine:ObjectMethod"),
    "VDoc:wide": true,
    "VDoc:cell": _objectMethodCell,
  },
};

const properties = {
  ...vocabulary,
  "column#03": {
    "VDoc:content": ["rdfs:domain"],
    "VDoc:cell": _simpleReferenceCell("rdfs:domain"),
  },
  "column#04": {
    "VDoc:content": ["rdfs:range"],
    "VDoc:cell": _simpleReferenceCell("rdfs:range"),
  },
};

const methods = {
  ...properties,
};

const elements = {
  ...vocabulary,
};

const types = {
  ...vocabulary,
  "column#02": {
    "VDoc:content": ["VRevdoc:brief"],
    "VDoc:cell": strong({ "VDoc:selectField": "VRevdoc:brief" }),
  },
  "column#03": {
    "VDoc:content": ["rdfs:subClassOf"],
    "VDoc:cell": _simpleReferenceCell("rdfs:subClassOf"),
  },
  "column#14": {
    "VDoc:content": ref("instance fields", "VModel:Field"),
    "VDoc:wide": true,
    "VDoc:cell": _instanceFieldCell,
  },
  "column#15": {
    "VDoc:content": ref("instance properties", "VEngine:Property"),
    "VDoc:wide": true,
    "VDoc:cell": _instancePropertyCell,
  },
  "column#16": {
    "VDoc:content": ref("instance methods", "VEngine:Method"),
    "VDoc:wide": true,
    "VDoc:cell": _instanceMethodCell,
  },
  "column#17": {
    "VDoc:content": ref("type object properties", "VEngine:ObjectProperty"),
    "VDoc:wide": true,
    "VDoc:cell": _objectPropertyCell,
  },
  "column#18": {
    "VDoc:content": ref("type object methods", "VEngine:ObjectMethod"),
    "VDoc:wide": true,
    "VDoc:cell": _objectMethodCell,
  },
};

const fields = {
  ...properties,
  "column#05": {
    "VDoc:content": "rdf:type",
    "VDoc:cell": _simpleReferenceCell("@type"),
  },
  "column#06": {
    "VDoc:content": "rdfs:subPropertyOf",
    "VDoc:cell": _simpleReferenceCell("rdfs:subPropertyOf"),
  },
  "column#07": {
    "VDoc:content": "VModel:coupledField",
    "VDoc:cell": _simpleReferenceCell("VModel:coupledField"),
  },
};

const verbs = {
  ...vocabulary,
  "column#03": {
    "VDoc:content": "rdf:type",
    "VDoc:cell": _simpleReferenceCell("@type"),
  },
  "column#02;comment": "Comment",
};

const globals = {
  ...vocabulary,
  "column#03": {
    "VDoc:content": "rdf:type",
    "VDoc:cell": _simpleReferenceCell("@type"),
  },
  "column#04;comment": "Comment",
  "column#14": {
    "VDoc:content": ref("prototype properties", "VEngine:Property"),
    "VDoc:wide": true,
    "VDoc:cell": _instancePropertyCell,
  },
  "column#15": {
    "VDoc:content": ref("prototype methods", "VEngine:Method"),
    "VDoc:wide": true,
    "VDoc:cell": _instanceMethodCell,
  },
  "column#16": {
    "VDoc:content": ref("object properties", "VEngine:ObjectProperty"),
    "VDoc:wide": true,
    "VDoc:cell": _objectPropertyCell,
  },
  "column#17": {
    "VDoc:content": ref("object methods", "VEngine:ObjectMethod"),
    "VDoc:wide": true,
    "VDoc:cell": _objectMethodCell,
  },
};

const objectProperties = {
  ...properties,
  "column#03": {
    "VDoc:content": ["rdf:subject"],
    "VDoc:cell": _simpleReferenceCell("rdf:subject"),
  },
};

const objectMethods = {
  ...methods,
  "column#03": {
    "VDoc:content": ["rdf:subject"],
    "VDoc:cell": _simpleReferenceCell("rdf:subject"),
  },
};

const vocabularyOther = {
  ...vocabulary,
  "column#03": {
    "VDoc:content": "rdf:type",
    "VDoc:cell": _simpleReferenceCell("@type"),
  },
  "column#04": {
    "VDoc:content": ["rdfs:subClassOf"],
    "VDoc:cell": {
      "VDoc:words": { "VDoc:selectField": "rdfs:subClassOf" },
      "VDoc:map": ref("VDoc:selectValue"),
    },
  },
};

const extractionRules = {
  "column#00;VDoc:selectKey": "Rule name",
  "column#01;range": "Inter-node rdf:type",
  "column#02;owner": "Owner property",
  "column#03;body": "Body property",
  "column#04;rest": "';rest' property",
  "column#05;comment": "Comment",
};

const extractee = {
  "column#00;VDoc:selectKey": "API identifier",
  "column#01;VDoc:selectValue": "rdf:type",
};

module.exports = {
  prefixes,

  vocabulary,
  classes,
  properties,
  methods,
  elements,
  types,
  fields,
  verbs,
  globals,
  objectProperties,
  objectMethods,

  vocabularyOther,

  extractionRules,
  extractee,

  context,
};
