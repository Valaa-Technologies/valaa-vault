// @flow

const { extension: { ontology, extractee, emitters } } = require("@valos/sbomdoc");
const {
  extractee: { authors, ref, /* dfn, */ pkg, filterKeysWithAnyOf, filterKeysWithNoneOf },
  ontologyHeaders,
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
    shortName: "sbomdoc",
    alternateFormats: [{ label: "VDoc", uri: "sbomdoc.vdocld" }],
  },
  "chapter#abstract>0": [
    `This document specifies SBomDoc, a `,
    ref("VDoc extension", "@valos/vdoc#extension"),
    ` for extracting and emitting `, ref("CycloneDX BOM documents", "https://cyclonedx.org/"),
    ` in various formats.`,
  ],
  "chapter#sotd>1": [
    `This document has not been reviewed. This is a draft document and
    may be updated, replaced or obsoleted by other documents at any
    time.`,
    null,
    `This document is part of the `, ref("ValOS core specification", "@valos/kernel/spec"),
    ".",
    null,
    `The format is implemented and supported by `, pkg("@valos/sbomdoc"),
    " npm package.",
  ],
  "chapter#introduction>2": [
    `SBoMDoc is a VDoc extension which uses CycloneDX namespaces and
    can emit BOM documents in various formats.`,
  ],
  "chapter#ontology>8;SBoMDoc ontology": {
    "#0": [],
    "data#prefixes": prefixes,
    "data#vocabulary": vocabulary,
    "data#context": context,
    "#section_ontology_abstract>0": [
      `SBoMDoc ontology provides vocabulary and definitions which are
      tailored for representing CycloneDX SBoM analysis semantic
      content.`
    ],
    "chapter#section_prefixes>1;SBoMDoc IRI prefixes": {
      "#0": [],
      "table#>0;prefixes": ontologyHeaders.prefixes,
    },
    [`chapter#section_classes>2;<em>${prefix}:* a vdoc:Class</em> vocabulary`]: {
      "#0": [],
      "table#>0;vocabulary": {
        "vdoc:headers": ontologyHeaders.classes,
        "vdoc:entries": filterKeysWithAnyOf("rdf:type", "vdoc:Class", vocabulary),
      },
    },
    [`chapter#section_properties>3;<em>${prefix}:* a vdoc:Property</em> vocabulary`]: {
      "#0": [],
      "table#>0;vocabulary": {
        "vdoc:headers": ontologyHeaders.properties,
        "vdoc:entries": filterKeysWithAnyOf("rdf:type", "vdoc:Property", vocabulary),
      },
    },
    [`chapter#section_vocabulary_other>8;<em>${prefix}:</em> other vocabulary`]: {
      "#0": [],
      "table#>0;vocabulary": {
        "vdoc:headers": ontologyHeaders.vocabularyOther,
        "vdoc:entries": filterKeysWithNoneOf(
            "rdf:type", ["vdoc:Class", "vdoc:Property"], vocabulary),
      },
    },
    "chapter#section_context>9;SBoMDoc JSON-LD context term definitions": {
      "#0": [],
      "table#>0;context": ontologyHeaders.context,
    },
  },
  "chapter#transformations>9;SBoMDoc transformations": {
    "#0": [],
    "chapter#extraction_rules>0;SBoMDoc extraction rules": {
      "#0": [],
      "table#>0;extraction_rules_data": ontologyHeaders.extractionRules,
      "data#extraction_rules_data": extractionRules,
    },
    "chapter#extractee_api>1;SBoMDoc extractee API": {
      "#0": [],
      "table#>0;extractee_api_lookup": ontologyHeaders.extractee,
      "data#extractee_api_lookup": extractee,
    },
    "chapter#emission_output>2;SBoMDoc emission output": {
      "#0": [],
    },
    "chapter#emission_rules>3;SBoMDoc emission rules": {
      "#0": [
        `ReVDoc provides html emission rules for `,
        { "vdoc:words": Object.keys(emitters.html) },
      ],
    },
  },
};
