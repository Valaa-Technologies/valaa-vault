// @flow

const {
  headers, extension,
  extractee: { authors, ref, /* dfn, */ filterVocabulary, filterVocabularyNot },
} = require("@valos/revdoc");

const { version, description } = require("./package");

const prefix = extension.ontology.prefix;

module.exports = {
  "dc:title": description,
  respecConfig: {
    subtitle: version,
    specStatus: "unofficial",
    editors: authors("iridian"),
    shortName: "revdoc",
    alternateFormats: [{ label: "VDoc", uri: "revdoc.jsonld" }],
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
    `The format is implemented and supported by `,
    ref("@valos/revdoc npm package", "@valos/revdoc"), ".",
  ],
  "chapter#introduction>2": [
    `ReVDoc is a VDoc extension which can produce ReSpec documents.`
  ],
  "chapter#ontology>8;ReVDoc ontology": {
    "data#prefixes": extension.ontology.prefixes,
    "data#vocabulary": extension.ontology.vocabulary,
    "data#context": extension.ontology.context,
    "chapter#ch_prefixes>0;ReVDoc IRI prefixes": {
      "#0": [],
      "table#>0;prefixes": headers.prefixes,
    },
    [`chapter#ch_classes>1;ReVDoc rdfs:Class vocabulary, prefix ${prefix}:`]: {
      "#0": [],
      "table#>0;vocabulary": {
        "vdoc:headers": headers.classes,
        "vdoc:entries": filterVocabulary("a", "rdfs:Class", extension.ontology.vocabulary),
      },
    },
    [`chapter#ch_properties>2;ReVDoc rdf:Property vocabulary, prefix ${prefix}:`]: {
      "#0": [],
      "table#>0;vocabulary": {
        "vdoc:headers": headers.properties,
        "vdoc:entries": filterVocabulary("a", "rdf:Property", extension.ontology.vocabulary),
      },
    },
    [`chapter#ch_remaining_vocabulary>3;ReVDoc remaining vocabulary, prefix ${prefix}:`]: {
      "#0": [],
      "table#>0;vocabulary": {
        "vdoc:headers": headers.vocabulary,
        "vdoc:entries": filterVocabularyNot("a", ["rdfs:Class", "rdf:Property"],
            extension.ontology.vocabulary),
      },
    },
    "chapter#ch_context>4;ReVDoc JSON-LD context term definitions": {
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
      "data#extraction_rules_data": extension.ontology.extractionRules,
    },
    "chapter#extractee_api>1;ReVDoc extractee API": {
      "#0": [],
      "table#>0;extractee_api_lookup": headers.extractee,
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
