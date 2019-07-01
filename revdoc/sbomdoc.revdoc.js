// @flow

const { ontology: sbomdocOntology } = require("../packages/toolset-vault/sbomdoc");
const {
  editors, extract, ref, /* dfn, */ ontologyTables,
} = require("../packages/toolset-vault/revdoc");

module.exports = {
  "vdoc:title": "SBoMDoc - Software Bill of Materials VDoc extension",
  respecConfig: {
    specStatus: "unofficial",
    editors: editors("iridian"),
    shortName: "sbomdoc",
  },
  "chapter#abstract>0": [
    `This document specifies`, ref("a VDoc extension", "vdoc"),
    `for generating`, ref("CycloneDX BOM documents", "https://cyclonedx.org/"),
    `in various formats.`,
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
    `SBoMDoc is a VDoc extension which uses CycloneDX namespaces and
    can emit BOM documents in various formats.`,
  ],
  "chapter#ontology>9;SBoMDoc ontology": {
    "chapter#prefixes>0;SBoMDoc JSON-LD prefixes": {
      "#0": [],
      "table#>0;prefixes_data": ontologyTables.prefixes,
      "data#prefixes_data": sbomdocOntology.prefixes,
    },
    "chapter#context>1;SBoMDoc JSON-LD context": {
      "#0": [],
      "table#>0;context_data": ontologyTables.context,
      "data#context_data": sbomdocOntology.context,
    },
    "chapter#vocabulary>2;SBoMDoc JSON-LD vocabulary": {
      "#0": [],
      "table#>0;vocabulary_data": ontologyTables.vocabulary,
      "data#vocabulary_data": sbomdocOntology.vocabulary,
    },
    "chapter#extraction_rules>3;SBoMDoc extraction rules": {
      "#0": [],
      "table#>0;extraction_rules_data": ontologyTables.extractionRules,
      "data#extraction_rules_data": sbomdocOntology.extractionRules,
    },
    "chapter#output>4;SBoMDoc output format": {
      "#0": [],
    },
    "chapter#emission>5;SBoMDoc emission rules": {
      "#0": [],
    },
  },
};
