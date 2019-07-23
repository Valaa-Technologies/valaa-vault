// @flow

const { extension } = require("@valos/sbomdoc");
const {
  ontologyTables, extractee: { authors, ref, /* dfn, */ },
} = require("@valos/revdoc");

const { version, description } = require("./package");

module.exports = {
  "dc:title": description,
  respecConfig: {
    subtitle: version,
    specStatus: "unofficial",
    editors: authors("iridian"),
    shortName: "sbomdoc",
    alternateFormats: [{ label: "VDoc", uri: "sbomdoc.jsonld" }],
  },
  "chapter#abstract>0": [
    `This document specifies SBomDoc, a `,
    ref("VDoc extension", "@valos/vdoc#extension"),
    `for extracting and emitting `, ref("CycloneDX BOM documents", "https://cyclonedx.org/"),
    `in various formats.`,
  ],
  "chapter#sotd>1": [
    `This document has not been reviewed. This is a draft document and
    may be updated, replaced or obsoleted by other documents at any
    time.`,
    null,
    `This document is part of the `, ref("ValOS core specification", "@valos/kernel/spec"),
    ".",
    null,
    `The format is implemented and supported by `,
    ref("@valos/sbomdoc npm package", "@valos/sbomdoc"), ".",
  ],
  "chapter#introduction>2": [
    `SBoMDoc is a VDoc extension which uses CycloneDX namespaces and
    can emit BOM documents in various formats.`,
  ],
  "chapter#ontology>8;SBoMDoc ontology": {
    "#0": [],
    "chapter#prefixes>0;SBoMDoc IRI prefixes": {
      "#0": [],
      "table#>0;prefixes_data": ontologyTables.prefixes,
      "data#prefixes_data": extension.ontology.prefixes,
    },
    [`chapter#vocabulary>1;SBoMDoc RDF vocabulary with prefix ${extension.ontology.prefix}:`]: {
      "#0": [],
      "table#>0;vocabulary_data": ontologyTables.vocabulary,
      "data#vocabulary_data": extension.ontology.vocabulary,
    },
    "chapter#context>2;SBoMDoc JSON-LD context term definitions": {
      "#0": [],
      "table#>0;context_data": ontologyTables.context,
      "data#context_data": extension.ontology.context,
    },
  },
  "chapter#transformations>9;SBoMDoc transformations": {
    "#0": [],
    "chapter#extraction_rules>0;SBoMDoc extraction rules": {
      "#0": [],
      "table#>0;extraction_rules_data": ontologyTables.extractionRules,
      "data#extraction_rules_data": extension.ontology.extractionRules,
    },
    "chapter#extractee_api>1;SBoMDoc extractee API": {
      "#0": [],
      "table#>0;extractee_api_lookup": ontologyTables.extractee,
      "data#extractee_api_lookup": extension.ontology.extractee,
    },
    "chapter#emission_output>2;SBoMDoc emission output": {
      "#0": [],
    },
    "chapter#emission_rules>3;SBoMDoc emission rules": {
      "#0": [
        `ReVDoc provides html emission overrides for `,
        { "vdoc:words": Object.keys(extension.emitters.html) },
      ],
    },
  },
};
