// @flow

const {
  ontologyTables, extension, extractee: { authors, ref, /* dfn, */  },
} = require("@valos/type-vault/revdoc");

const { version } = require("../package");

module.exports = {
  "dc:title": "ReVDoc - ReSpec document VDoc extension",
  respecConfig: {
    subtitle: version,
    specStatus: "unofficial",
    editors: authors("iridian"),
    shortName: "revdoc",
    alternateFormats: [{ label: "VDoc", uri: "revdoc.jsonld" }],
  },
  "chapter#abstract>0": [
    `This document specifies ReVDoc, a `,
    ref("VDoc extension", "@valos/type-vault/vdoc#extension"),
    ` for extracting and emitting `, ref("ReSpec documents", "https://github.com/w3c/respec"),
    `.`,
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
    ref("@valos/type-vault npm package", "@valos/type-vault"), ".",
  ],
  "chapter#introduction>2": [
    `ReVDoc is a VDoc extension which can produce ReSpec documents.`
  ],
  "chapter#ontology>8;ReVDoc ontology": {
    "chapter#prefixes>0;ReVDoc IRI prefixes": {
      "#0": [],
      "table#>0;prefixes_data": ontologyTables.prefixes,
      "data#prefixes_data": extension.ontology.prefixes,
    },
    [`chapter#vocabulary>1;ReVDoc RDF vocabulary with prefix ${extension.ontology.prefix}:`]: {
      "#0": [],
      "table#>0;vocabulary_data": ontologyTables.vocabulary,
      "data#vocabulary_data": extension.ontology.vocabulary,
    },
    "chapter#context>2;ReVDoc JSON-LD context term definitions": {
      "#0": [],
      "table#>0;context_data": ontologyTables.context,
      "data#context_data": extension.ontology.context,
    },
  },
  "chapter#transformations>9:ReVDoc transformations": {
    "#0": [
      `ReVDoc lightly extends basic VDoc extraction with some
      ReSpec specific primitives and specifies a ReSpec html emission
      transformation.`,
    ],
    "chapter#extraction_rules>0;ReVDoc extraction rules": {
      "#0": [],
      "table#>0;extraction_rules_data": ontologyTables.extractionRules,
      "data#extraction_rules_data": extension.ontology.extractionRules,
    },
    "chapter#extractee_api>1;ReVDoc extractee API": {
      "#0": [],
      "table#>0;extractee_api_lookup": ontologyTables.extractee,
      "data#extractee_api_lookup": extension.extractee,
    },
    "chapter#emission_output>2;ReVDoc emission output": {
      "#0": [
        `ReVDoc emits html which makes use of ReSpec primitives.`
      ],
    },
    "chapter#emission_rules>3;ReVDoc emission rules": {
      "#0": [
        `ReVDoc provides html emission overrides for `,
        { "vdoc:words": Object.keys(extension.emitters.html) },
      ],
    },
  },
};
