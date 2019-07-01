// @flow

const {
  ontologyTables, ontology: revdocOntology, extractee: { editors, ref, /* dfn, */  },
} = require("@valos/toolset-vault/revdoc");

module.exports = {
  "vdoc:title": "ReVDoc - ReSpec document VDoc extension",
  respecConfig: {
    specStatus: "unofficial",
    editors: editors("iridian"),
    shortName: "revdoc",
  },
  "chapter#abstract>0": [
    `This document specifies`, ref("a VDoc extension", "vdoc"),
    `for generating`, ref("ReSpec", "https://github.com/w3c/respec"),
    `documents.`,
  ],
  "chapter#sotd>1": [
    `This document has not been reviewed. This is a draft document and
    may be updated, replaced or obsoleted by other documents at any
    time.`,
    null,
    `This document is part of the `, ref("ValOS core specification", "@valos/vault/spec"),
    ".",
    null,
    `The format is implemented and supported by `,
    ref("@valos/toolset-vault npm package", "@valos/toolset-vault"), ".",
  ],
  "chapter#introduction>2": [
    `ReVDoc is a VDoc extension which can produce ReSpec documents.`
  ],
  "chapter#ontology>9;ReVDoc ontology": {
    "chapter#prefixes>0;ReVDoc JSON-LD prefixes": {
      "#0": [],
      "table#>0;prefixes_data": ontologyTables.prefixes,
      "data#prefixes_data": revdocOntology.prefixes,
    },
    "chapter#context>1;ReVDoc JSON-LD context": {
      "#0": [],
      "table#>0;context_data": ontologyTables.context,
      "data#context_data": revdocOntology.context,
    },
    "chapter#vocabulary>2;ReVDoc JSON-LD vocabulary": {
      "#0": [],
      "table#>0;vocabulary_data": ontologyTables.vocabulary,
      "data#vocabulary_data": revdocOntology.vocabulary,
    },
    "chapter#extraction_rules>3;ReVDoc extraction rules": {
      "#0": [],
      "table#>0;extraction_rules_data": ontologyTables.extractionRules,
      "data#extraction_rules_data": revdocOntology.extractionRules,
    },
    "chapter#extractee_api>4;ReVDoc extractee API": {
      "#0": [],
      "table#>0;extractee_api_lookup": ontologyTables.extracteeAPI,
      "data#extractee_api_lookup": revdocOntology.extracteeAPI,
    },
    "chapter#output>4;ReVDoc output format": {
      "#0": [],
    },
    "chapter#emission>5;ReVDoc emission rules": {
      "#0": [],
    },
  },
};
