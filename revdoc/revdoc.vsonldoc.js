// @flow

const { extract, ontology: vdocOntology } = require("../packages/toolset-vault/vdoc");
const {
  editors, ref, dfn, ontologyTables,
  ontology: revdocOntology,
} = require("../packages/toolset-vault/revdoc");

module.exports = extract("http://valospace.org/revdoc", {
  title: "ReVDoc - ReSpec document VDoc extension",
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
    `ReVDoc is a VDox extension which can produce ReSpec documents.`
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
    "chapter#output>4;ReVDoc output format": {
      "#0": [],
    },
    "chapter#emission>5;ReVDoc emission rules": {
      "#0": [],
    },
  },
}, [revdocOntology, vdocOntology]);
