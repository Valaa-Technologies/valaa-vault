// @flow

const {
  headers,
  extension: { ontology, extractee, emitters },
  extractee: { authors, ref, /* dfn, */ pkg, filterKeysWithAnyOf, filterKeysWithNoneOf },
} = require("@valos/revdoc");

const { name, version, description } = require("./package");

const { prefix, prefixIRI, prefixes, vocabulary, context, extractionRules } = ontology;

module.exports = {
  "dc:title": description,
  "vdoc:tags": ["PRIMARY", "ONTOLOGY"],
  "revdoc:package": name,
  "revdoc:prefix": prefix,
  "revdoc:prefixIRI": prefixIRI,
  "revdoc:version": version,
  respecConfig: {
    subtitle: version,
    specStatus: "unofficial",
    editors: authors("iridian"),
    shortName: "revdoc",
    alternateFormats: [{ label: "VDoc", uri: "revdoc.vdocld" }],
  },
  "chapter#abstract>0": [
    `This document specifies ReVDoc, a `,
    ref("VDoc extension", "@valos/vdoc#extension"),
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
    `The format is implemented and supported by `, pkg("@valos/revdoc"),
    " npm package.",
  ],
  "chapter#introduction>2": [
    `ReVDoc is a VDoc extension which can produce ReSpec documents.`
  ],
  "chapter#ontology>8;ReVDoc ontology": {
    "data#prefixes": prefixes,
    "data#vocabulary": vocabulary,
    "data#context": context,
    "#section_ontology_abstract>0": [
      `ReVDoc ontology provides vocabulary and definitions which are
      tailored for emitting ReSpec html output documents.`
    ],
    "chapter#section_prefixes>1;ReVDoc IRI prefixes": {
      "#0": [],
      "table#>0;prefixes": headers.prefixes,
    },
    [`chapter#section_classes>2;<em>${prefix}:* a vdoc:Class</em> vocabulary`]: {
      "#0": [],
      "table#>0;vocabulary": {
        "vdoc:headers": headers.classes,
        "vdoc:entries": filterKeysWithAnyOf("a", "rdfs:Class", vocabulary),
      },
    },
    [`chapter#section_properties>3;<em>${prefix}:* a vdoc:Property</em> vocabulary`]: {
      "#0": [],
      "table#>0;vocabulary": {
        "vdoc:headers": headers.properties,
        "vdoc:entries": filterKeysWithAnyOf("a", "rdf:Property", vocabulary),
      },
    },
    [`chapter#section_vocabulary_other>8;<em>${prefix}:</em> other vocabulary`]: {
      "#0": [],
      "table#>0;vocabulary": {
        "vdoc:headers": headers.vocabulary,
        "vdoc:entries": filterKeysWithNoneOf("a", ["rdfs:Class", "rdf:Property"], vocabulary),
      },
    },
    "chapter#section_context>9;ReVDoc JSON-LD context term definitions": {
      "#0": [],
      "table#>0;context": headers.context,
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
      "table#>0;extraction_rules_data": headers.extractionRules,
      "data#extraction_rules_data": extractionRules,
    },
    "chapter#extractee_api>1;ReVDoc extractee API": {
      "#0": [],
      "table#>0;extractee_api_lookup": headers.extractee,
      "data#extractee_api_lookup": extractee,
    },
    "chapter#emission_output>2;ReVDoc emission output": {
      "#0": [
        `ReVDoc emits html which makes use of ReSpec primitives.`
      ],
    },
    "chapter#emission_rules>3;ReVDoc emission rules": {
      "#0": [
        `ReVDoc provides html emission rules for `,
        { "vdoc:words": Object.keys(emitters.html) },
      ],
    },
  },
};
